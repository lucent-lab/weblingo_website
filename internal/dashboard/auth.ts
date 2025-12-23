import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { AccountMe } from "./webhooks";
import {
  exchangeWebhooksToken,
  fetchAccountMe,
  listAgencyCustomers,
  WebhooksApiError,
  type AgencyCustomersResponse,
} from "./webhooks";
import { createHas, type HasCheck } from "./entitlements";
import { readSubjectAccountId } from "./workspace";

export type WebhooksAuthContext = {
  token: string;
  expiresAt: string;
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
  actorPlanActive: boolean;
  subjectPlanActive: boolean;
  mutationsAllowed: boolean;
  billingIssue: BillingIssue | null;
  has: (requirement: HasCheck) => boolean;
};

const WEBHOOKS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

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
  renderEnabled: false,
  agencyActionsEnabled: false,
  demoMode: false,
  maxSites: null,
  maxLocales: null,
  maxDailyRecrawls: null,
  maxGlossarySources: null,
  featurePreview: [],
};

const FALLBACK_QUOTAS: AccountMe["quotas"] = {
  maxSites: null,
  starterQuota: null,
  proQuota: null,
};

type TokenEntitlements = Awaited<ReturnType<typeof exchangeWebhooksToken>>["entitlements"];

function buildFallbackAccount(accountId: string, entitlements: TokenEntitlements): AccountMe {
  return {
    accountId,
    planType: entitlements.planType,
    planStatus: entitlements.planStatus,
    featureFlags: FALLBACK_FEATURE_FLAGS,
    quotas: FALLBACK_QUOTAS,
  };
}

function isExpiringSoon(expiresAt: string): boolean {
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) {
    return true;
  }
  return parsed - Date.now() <= WEBHOOKS_TOKEN_REFRESH_BUFFER_MS;
}

async function mintWebhooksAuth(
  supabaseAccessToken: string,
  subjectAccountId?: string | null,
): Promise<{
  auth: WebhooksAuthContext;
  entitlements: TokenEntitlements;
  actorAccountId: string;
  subjectAccountId: string;
}> {
  const issueToken = () => exchangeWebhooksToken(supabaseAccessToken, subjectAccountId);
  let tokenResponse = await issueToken();
  if (isExpiringSoon(tokenResponse.expiresAt)) {
    tokenResponse = await issueToken();
  }
  const auth: WebhooksAuthContext = {
    token: tokenResponse.token,
    expiresAt: tokenResponse.expiresAt,
    refresh: async () => {
      const refreshed = await issueToken();
      auth.token = refreshed.token;
      auth.expiresAt = refreshed.expiresAt;
      return refreshed.token;
    },
  };
  return {
    auth,
    entitlements: tokenResponse.entitlements,
    actorAccountId: tokenResponse.actorAccountId,
    subjectAccountId: tokenResponse.subjectAccountId,
  };
}

async function safeFetchAccount(
  auth: WebhooksAuthContext,
  entitlements: TokenEntitlements,
  accountId: string,
): Promise<AccountMe> {
  try {
    return await fetchAccountMe(auth);
  } catch (error) {
    if (error instanceof WebhooksApiError && error.status === 403) {
      console.warn("[dashboard] account is not active; using fallback entitlements.");
      return buildFallbackAccount(accountId, entitlements);
    }
    throw error;
  }
}

export const getDashboardAuth = cache(async (): Promise<DashboardAuth> => {
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
      actorPlanActive: false,
      subjectPlanActive: false,
      mutationsAllowed: false,
      billingIssue: null,
      has: () => false,
    };
  }

  const actorToken = await mintWebhooksAuth(session.access_token);
  const actorAccount = await safeFetchAccount(
    actorToken.auth,
    actorToken.entitlements,
    actorToken.subjectAccountId,
  );
  const requestedSubjectId = await readSubjectAccountId();

  let agencyCustomers: AgencyCustomersResponse | null = null;
  if (actorAccount.planType === "agency" && actorAccount.featureFlags.agencyActionsEnabled) {
    try {
      agencyCustomers = await listAgencyCustomers(actorToken.auth);
    } catch (error) {
      console.warn("[dashboard] listAgencyCustomers failed:", error);
    }
  }

  const allowedSubjectIds = new Set<string>();
  allowedSubjectIds.add(actorToken.subjectAccountId);
  if (agencyCustomers) {
    for (const customer of agencyCustomers.customers) {
      if (customer.status === "active") {
        allowedSubjectIds.add(customer.customerAccountId);
      }
    }
  }

  let subjectToken = actorToken;
  let subjectAccount = actorAccount;
  let actingAsCustomer = false;
  if (
    requestedSubjectId &&
    requestedSubjectId !== actorToken.subjectAccountId &&
    allowedSubjectIds.has(requestedSubjectId)
  ) {
    try {
      subjectToken = await mintWebhooksAuth(session.access_token, requestedSubjectId);
      subjectAccount = await safeFetchAccount(
        subjectToken.auth,
        subjectToken.entitlements,
        subjectToken.subjectAccountId,
      );
      actingAsCustomer = true;
    } catch (error) {
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
    webhooksAuth: subjectToken.auth,
    account: subjectAccount,
    actorAccount,
    subjectAccount,
    actorWebhooksAuth: actorToken.auth,
    agencyCustomers,
    actorAccountId: actorToken.actorAccountId,
    subjectAccountId: subjectToken.subjectAccountId,
    actingAsCustomer,
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
