import { createHash } from "node:crypto";

import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { redis } from "@/internal/core/redis";
import { createClient } from "@/lib/supabase/server";

import type { AccountMe } from "./webhooks";
import {
  exchangeWebhooksToken,
  fetchDashboardBootstrap,
  WebhooksApiError,
  type AgencyCustomersResponse,
} from "./webhooks";
import { createHas, type HasCheck } from "./entitlements";
import { isDashboardE2eMockEnabled } from "./e2e-mock";
import { readSubjectAccountId } from "./workspace";

export type WebhooksAuthContext = {
  token: string;
  expiresAt: string;
  subjectAccountId: string;
  refresh: () => Promise<string>;
};

export type BillingIssue = {
  scope: "actor" | "subject";
  status: AccountMe["planStatus"];
};

export type DashboardAuth = {
  user: User | null;
  session: Session | null;
  webhooksAuth: WebhooksAuthContext | null;
  account: AccountMe | null;
  actorAccount: AccountMe | null;
  subjectAccount: AccountMe | null;
  actorWebhooksAuth: WebhooksAuthContext | null;
  agencyCustomers: AgencyCustomersResponse | null;
  actorAccountId: string | null;
  subjectAccountId: string | null;
  actingAsCustomer: boolean;
  subjectFallbackToActor: boolean;
  actorPlanActive: boolean;
  subjectPlanActive: boolean;
  mutationsAllowed: boolean;
  billingIssue: BillingIssue | null;
  has: (requirement: HasCheck) => boolean;
};

const BOOTSTRAP_CACHE_NAMESPACE = "dashboard:bootstrap";
const BOOTSTRAP_CACHE_MAX_TTL_SECONDS = 300;
const BOOTSTRAP_CACHE_MIN_TTL_SECONDS = 30;
const BOOTSTRAP_CACHE_EXPIRY_BUFFER_SECONDS = 60;
const DASHBOARD_E2E_ACCOUNT_ID = "acct-e2e-smoke";
const DASHBOARD_E2E_TOKEN = "dashboard-e2e-smoke-token";

const FALLBACK_FEATURE_FLAGS: AccountMe["featureFlags"] = {
  editEnabled: false,
  slugEditEnabled: false,
  glossaryEnabled: false,
  overridesEnabled: false,
  tmWriteEnabled: false,
  publishEnabled: false,
  pipelineAllowed: false,
  serveAllowed: false,
  siteCreateEnabled: false,
  localeUpdateEnabled: false,
  domainVerifyEnabled: false,
  crawlTriggerEnabled: false,
  crawlCaptureModeEnabled: false,
  clientRuntimeToggleEnabled: false,
  translatableAttributesEnabled: false,
  renderEnabled: false,
  agencyActionsEnabled: false,
  internalOpsEnabled: false,
  demoMode: false,
  maxSites: null,
  maxLocales: null,
  maxDailyRecrawls: null,
  maxDailyPageRecrawls: null,
  maxGlossarySources: null,
  featurePreview: [],
};

const FALLBACK_QUOTAS: AccountMe["quotas"] = {
  maxSites: null,
  freeQuota: null,
  starterQuota: null,
  proQuota: null,
};

type TokenEntitlements = Awaited<ReturnType<typeof exchangeWebhooksToken>>["entitlements"];

type BootstrapCacheEntry = {
  token: string;
  expiresAt: string;
  entitlements: TokenEntitlements;
  actorAccountId: string;
  subjectAccountId: string;
  account: AccountMe;
  agencyCustomers: AgencyCustomersResponse | null;
};

type BootstrapOptions = {
  supabaseAccessToken: string;
  subjectAccountId?: string | null;
  includeAgencyCustomers?: boolean;
};

const bootstrapInflight = new Map<string, Promise<BootstrapCacheEntry>>();

function buildFallbackAccount(accountId: string, entitlements: TokenEntitlements): AccountMe {
  const today = new Date().toISOString().slice(0, 10);
  return {
    accountId,
    planType: entitlements.planType,
    planStatus: entitlements.planStatus,
    featureFlags: FALLBACK_FEATURE_FLAGS,
    dailyCrawlUsage: {
      date: today,
      siteCrawls: 0,
      pageCrawls: 0,
    },
    usageCounters: {
      periodStart: today,
      periodEnd: today,
      pagesPublished: 0,
      charsTranslated: 0,
      rebuildsTriggered: 0,
      dailySiteCrawls: 0,
      dailyPageCrawls: 0,
    },
    quotaLimits: {
      maxSites: null,
      translationChars: null,
      dailySiteCrawls: null,
      dailyPageCrawls: null,
      previewRequests: null,
    },
    quotas: FALLBACK_QUOTAS,
  };
}

function normalizeSubjectAccountId(subjectAccountId?: string | null): string {
  return subjectAccountId?.trim() ?? "";
}

function getCacheEnvPrefix(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
}

function getBootstrapCacheKey(
  supabaseAccessToken: string,
  subjectAccountId?: string | null,
): string {
  const normalizedSubjectId = normalizeSubjectAccountId(subjectAccountId);
  const digest = createHash("sha256")
    .update(`${supabaseAccessToken}:${normalizedSubjectId}`)
    .digest("hex");
  return `${BOOTSTRAP_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;
}

function getBootstrapCacheTtlSeconds(expiresAt: string): number | null {
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const secondsUntilExpiry = Math.floor((parsed - Date.now()) / 1000);
  const ttlSeconds = Math.min(
    BOOTSTRAP_CACHE_MAX_TTL_SECONDS,
    secondsUntilExpiry - BOOTSTRAP_CACHE_EXPIRY_BUFFER_SECONDS,
  );
  if (ttlSeconds < BOOTSTRAP_CACHE_MIN_TTL_SECONDS) {
    return null;
  }
  return ttlSeconds;
}

function buildWebhooksAuthContext(
  payload: BootstrapCacheEntry,
  supabaseAccessToken: string,
): WebhooksAuthContext {
  const auth: WebhooksAuthContext = {
    token: payload.token,
    expiresAt: payload.expiresAt,
    subjectAccountId: payload.subjectAccountId,
    refresh: async () => {
      const refreshed = await exchangeWebhooksToken(supabaseAccessToken, payload.subjectAccountId);
      auth.token = refreshed.token;
      auth.expiresAt = refreshed.expiresAt;
      auth.subjectAccountId = refreshed.subjectAccountId;
      return refreshed.token;
    },
  };
  return auth;
}

function buildDashboardE2eMockAuth(): DashboardAuth {
  const today = new Date().toISOString().slice(0, 10);
  const account: AccountMe = {
    accountId: DASHBOARD_E2E_ACCOUNT_ID,
    planType: "starter",
    planStatus: "active",
    featureFlags: {
      editEnabled: true,
      slugEditEnabled: true,
      glossaryEnabled: true,
      overridesEnabled: true,
      tmWriteEnabled: true,
      publishEnabled: true,
      pipelineAllowed: true,
      serveAllowed: true,
      siteCreateEnabled: true,
      localeUpdateEnabled: true,
      domainVerifyEnabled: true,
      crawlTriggerEnabled: true,
      crawlCaptureModeEnabled: true,
      clientRuntimeToggleEnabled: true,
      translatableAttributesEnabled: true,
      renderEnabled: true,
      agencyActionsEnabled: false,
      internalOpsEnabled: false,
      demoMode: true,
      maxSites: 10,
      maxLocales: 8,
      maxDailyRecrawls: 20,
      maxDailyPageRecrawls: 200,
      maxGlossarySources: 200,
      featurePreview: [],
    },
    dailyCrawlUsage: {
      date: today,
      siteCrawls: 1,
      pageCrawls: 3,
    },
    usageCounters: {
      periodStart: today,
      periodEnd: today,
      pagesPublished: 2,
      charsTranslated: 500,
      rebuildsTriggered: 1,
      dailySiteCrawls: 1,
      dailyPageCrawls: 3,
    },
    quotaLimits: {
      maxSites: 10,
      translationChars: 10_000,
      dailySiteCrawls: 20,
      dailyPageCrawls: 200,
      previewRequests: null,
    },
    quotas: {
      maxSites: 10,
      freeQuota: 1,
      starterQuota: 10,
      proQuota: 50,
    },
  };
  const webhooksAuth: WebhooksAuthContext = {
    token: DASHBOARD_E2E_TOKEN,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    subjectAccountId: DASHBOARD_E2E_ACCOUNT_ID,
    refresh: async () => DASHBOARD_E2E_TOKEN,
  };
  const user = {
    id: "user-e2e-smoke",
    email: "e2e-smoke@weblingo.app",
  } as User;
  const session = {
    access_token: "e2e-smoke-access-token",
    refresh_token: "e2e-smoke-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;

  return {
    user,
    session,
    webhooksAuth,
    account,
    actorAccount: account,
    subjectAccount: account,
    actorWebhooksAuth: webhooksAuth,
    agencyCustomers: null,
    actorAccountId: DASHBOARD_E2E_ACCOUNT_ID,
    subjectAccountId: DASHBOARD_E2E_ACCOUNT_ID,
    actingAsCustomer: false,
    subjectFallbackToActor: false,
    actorPlanActive: true,
    subjectPlanActive: true,
    mutationsAllowed: true,
    billingIssue: null,
    has: createHas(account),
  };
}

async function getBootstrap({
  supabaseAccessToken,
  subjectAccountId,
  includeAgencyCustomers = false,
}: BootstrapOptions): Promise<BootstrapCacheEntry> {
  const cacheKey = getBootstrapCacheKey(supabaseAccessToken, subjectAccountId);

  try {
    const cached = await redis.get<BootstrapCacheEntry>(cacheKey);
    if (cached) {
      console.info("[dashboard] bootstrap cache hit");
      return cached;
    }
  } catch (error) {
    console.warn("[dashboard] bootstrap cache read failed:", error);
  }

  console.info("[dashboard] bootstrap cache miss");

  const inflight = bootstrapInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    let payload: BootstrapCacheEntry;
    try {
      const bootstrap = await fetchDashboardBootstrap(supabaseAccessToken, {
        subjectAccountId,
        includeAgencyCustomers,
      });
      payload = {
        token: bootstrap.token,
        expiresAt: bootstrap.expiresAt,
        entitlements: bootstrap.entitlements,
        actorAccountId: bootstrap.actorAccountId,
        subjectAccountId: bootstrap.subjectAccountId,
        account: bootstrap.account,
        agencyCustomers: bootstrap.agencyCustomers,
      };
    } catch (error) {
      if (error instanceof WebhooksApiError && error.status === 403) {
        console.warn("[dashboard] bootstrap returned 403; using fallback entitlements.");
        const tokenResponse = await exchangeWebhooksToken(supabaseAccessToken, subjectAccountId);
        payload = {
          token: tokenResponse.token,
          expiresAt: tokenResponse.expiresAt,
          entitlements: tokenResponse.entitlements,
          actorAccountId: tokenResponse.actorAccountId,
          subjectAccountId: tokenResponse.subjectAccountId,
          account: buildFallbackAccount(tokenResponse.subjectAccountId, tokenResponse.entitlements),
          agencyCustomers: null,
        };
      } else {
        throw error;
      }
    }

    const ttlSeconds = getBootstrapCacheTtlSeconds(payload.expiresAt);
    if (ttlSeconds) {
      try {
        await redis.set(cacheKey, payload, { ex: ttlSeconds });
      } catch (error) {
        console.warn("[dashboard] bootstrap cache write failed:", error);
      }
    }

    return payload;
  })();

  bootstrapInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    bootstrapInflight.delete(cacheKey);
  }
}

export const getDashboardAuth = cache(async (): Promise<DashboardAuth> => {
  if (isDashboardE2eMockEnabled()) {
    return buildDashboardE2eMockAuth();
  }

  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    {
      data: { user },
    },
  ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (!session || !user) {
    return {
      user: null,
      session: null,
      webhooksAuth: null,
      account: null,
      actorAccount: null,
      subjectAccount: null,
      actorWebhooksAuth: null,
      agencyCustomers: null,
      actorAccountId: null,
      subjectAccountId: null,
      actingAsCustomer: false,
      subjectFallbackToActor: false,
      actorPlanActive: false,
      subjectPlanActive: false,
      mutationsAllowed: false,
      billingIssue: null,
      has: () => false,
    };
  }

  const actorBootstrap = await getBootstrap({
    supabaseAccessToken: session.access_token,
    includeAgencyCustomers: true,
  });
  const actorAuth = buildWebhooksAuthContext(actorBootstrap, session.access_token);
  const actorAccount = actorBootstrap.account;
  const requestedSubjectId = await readSubjectAccountId();
  const agencyCustomers = actorBootstrap.agencyCustomers;

  const allowedSubjectIds = new Set<string>();
  allowedSubjectIds.add(actorBootstrap.subjectAccountId);
  if (agencyCustomers) {
    for (const customer of agencyCustomers.customers) {
      if (customer.status === "active") {
        allowedSubjectIds.add(customer.customerAccountId);
      }
    }
  }

  let subjectBootstrap = actorBootstrap;
  let subjectAuth = actorAuth;
  let subjectAccount = actorAccount;
  let actingAsCustomer = false;
  let subjectFallbackToActor = false;
  if (
    requestedSubjectId &&
    requestedSubjectId !== actorBootstrap.subjectAccountId &&
    allowedSubjectIds.has(requestedSubjectId)
  ) {
    try {
      subjectBootstrap = await getBootstrap({
        supabaseAccessToken: session.access_token,
        subjectAccountId: requestedSubjectId,
      });
      subjectAuth = buildWebhooksAuthContext(subjectBootstrap, session.access_token);
      subjectAccount = subjectBootstrap.account;
      actingAsCustomer = true;
    } catch (error) {
      subjectFallbackToActor = true;
      console.warn("[dashboard] subject account exchange failed:", error);
    }
  }

  const actorPlanActive = actorAccount.planStatus === "active";
  const subjectPlanActive = subjectAccount.planStatus === "active";
  const billingIssue = !actorPlanActive
    ? ({ scope: "actor", status: actorAccount.planStatus } as const)
    : !subjectPlanActive
      ? ({ scope: "subject", status: subjectAccount.planStatus } as const)
      : null;
  const mutationsAllowed = actorPlanActive && subjectPlanActive;

  return {
    user,
    session,
    webhooksAuth: subjectAuth,
    account: subjectAccount,
    actorAccount,
    subjectAccount,
    actorWebhooksAuth: actorAuth,
    agencyCustomers,
    actorAccountId: actorBootstrap.actorAccountId,
    subjectAccountId: subjectBootstrap.subjectAccountId,
    actingAsCustomer,
    subjectFallbackToActor,
    actorPlanActive,
    subjectPlanActive,
    mutationsAllowed,
    billingIssue,
    has: createHas(subjectAccount),
  };
});

export async function requireDashboardAuth(): Promise<DashboardAuth> {
  const auth = await getDashboardAuth();
  if (!auth.user || !auth.session) {
    redirect("/auth/login");
  }
  if (!auth.webhooksAuth || !auth.account) {
    redirect("/dashboard/no-account");
  }
  return auth;
}

export async function requireWebhooksAuth(): Promise<WebhooksAuthContext> {
  const auth = await requireDashboardAuth();
  if (!auth.webhooksAuth) {
    redirect("/dashboard/no-account");
  }
  return auth.webhooksAuth;
}
