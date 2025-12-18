import type { AccountMe } from "./webhooks";

export type PlanType = AccountMe["planType"];
export type PlanStatus = AccountMe["planStatus"];
export type FeatureFlags = AccountMe["featureFlags"];

/**
 * Site-scoped tier used by the webhooks API for per-site capabilities.
 *
 * This is intentionally narrower than `PlanType`:
 * - `agency` is account-level only (who is paying / who can act on behalf of others).
 * - `free` maps to starter capabilities for sites in v1 (the OpenAPI `sitePlan` enum is starter|pro).
 */
export type SitePlan = "starter" | "pro";

/**
 * Dashboard-side authorization helper inspired by `@weblingo/common` entitlements,
 * kept local to avoid cross-repo dependencies.
 */

export type WebLingoFeature =
  | "edit"
  | "slug_edit"
  | "glossary"
  | "overrides"
  | "tm_write"
  | "publish"
  | "pipeline"
  | "serve"
  | "site_create"
  | "locale_update"
  | "domain_verify"
  | "crawl_trigger"
  | "render"
  | "agency_actions";

const FEATURE_FLAG_BY_FEATURE: Record<WebLingoFeature, keyof FeatureFlags> = {
  edit: "editEnabled",
  slug_edit: "slugEditEnabled",
  glossary: "glossaryEnabled",
  overrides: "overridesEnabled",
  tm_write: "tmWriteEnabled",
  publish: "publishEnabled",
  pipeline: "pipelineAllowed",
  serve: "serveAllowed",
  site_create: "siteCreateEnabled",
  locale_update: "localeUpdateEnabled",
  domain_verify: "domainVerifyEnabled",
  crawl_trigger: "crawlTriggerEnabled",
  render: "renderEnabled",
  agency_actions: "agencyActionsEnabled",
};

export type WebLingoQuota = "maxSites" | "maxLocales" | "maxDailyRecrawls" | "maxGlossarySources";

export type HasCheck =
  | { plan: PlanType | readonly PlanType[] }
  | { status: PlanStatus | readonly PlanStatus[] }
  | { feature: WebLingoFeature }
  | { anyFeature: readonly WebLingoFeature[] }
  | { allFeatures: readonly WebLingoFeature[] }
  | { preview: string }
  | { anyPreview: readonly string[] }
  | { allPreviews: readonly string[] }
  | { quotaWithin: { quota: WebLingoQuota; value: number } };

export type HasFailureReason =
  | { kind: "plan"; expected: PlanType[]; actual: PlanType }
  | { kind: "status"; expected: PlanStatus[]; actual: PlanStatus }
  | { kind: "feature"; feature: WebLingoFeature }
  | { kind: "preview"; preview: string }
  | { kind: "quota"; quota: WebLingoQuota; value: number; limit: number | null };

export type AccessCheckResult = { ok: true } | { ok: false; reason: HasFailureReason };

export function check(
  account: Pick<AccountMe, "planType" | "planStatus" | "featureFlags">,
  requirement: HasCheck,
) {
  if ("plan" in requirement) {
    const expected = Array.isArray(requirement.plan) ? [...requirement.plan] : [requirement.plan];
    if (!expected.length) {
      throw new Error("has({ plan }) requires at least one plan value");
    }
    return expected.includes(account.planType)
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "plan", expected, actual: account.planType } } as const);
  }

  if ("status" in requirement) {
    const expected = Array.isArray(requirement.status)
      ? [...requirement.status]
      : [requirement.status];
    if (!expected.length) {
      throw new Error("has({ status }) requires at least one status value");
    }
    return expected.includes(account.planStatus)
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "status", expected, actual: account.planStatus } } as const);
  }

  if ("feature" in requirement) {
    const key = FEATURE_FLAG_BY_FEATURE[requirement.feature];
    return account.featureFlags[key]
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "feature", feature: requirement.feature } } as const);
  }

  if ("anyFeature" in requirement) {
    if (!requirement.anyFeature.length) {
      throw new Error("has({ anyFeature }) requires at least one feature");
    }
    const ok = requirement.anyFeature.some((feature) => {
      const key = FEATURE_FLAG_BY_FEATURE[feature];
      return account.featureFlags[key] === true;
    });
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "feature", feature: requirement.anyFeature[0] } } as const);
  }

  if ("allFeatures" in requirement) {
    if (!requirement.allFeatures.length) {
      throw new Error("has({ allFeatures }) requires at least one feature");
    }
    const ok = requirement.allFeatures.every((feature) => {
      const key = FEATURE_FLAG_BY_FEATURE[feature];
      return account.featureFlags[key] === true;
    });
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "feature", feature: requirement.allFeatures[0] } } as const);
  }

  if ("preview" in requirement) {
    const ok = account.featureFlags.featurePreview.includes(requirement.preview);
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "preview", preview: requirement.preview } } as const);
  }

  if ("anyPreview" in requirement) {
    if (!requirement.anyPreview.length) {
      throw new Error("has({ anyPreview }) requires at least one preview key");
    }
    const ok = requirement.anyPreview.some((preview) =>
      account.featureFlags.featurePreview.includes(preview),
    );
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "preview", preview: requirement.anyPreview[0] } } as const);
  }

  if ("allPreviews" in requirement) {
    if (!requirement.allPreviews.length) {
      throw new Error("has({ allPreviews }) requires at least one preview key");
    }
    const ok = requirement.allPreviews.every((preview) =>
      account.featureFlags.featurePreview.includes(preview),
    );
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "preview", preview: requirement.allPreviews[0] } } as const);
  }

  if ("quotaWithin" in requirement) {
    const { quota, value } = requirement.quotaWithin;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`has({ quotaWithin }) requires a non-negative finite value (got ${value})`);
    }
    const limit = account.featureFlags[quota] as number | null;
    const ok = limit === null || value <= limit;
    return ok
      ? ({ ok: true } as const)
      : ({ ok: false, reason: { kind: "quota", quota, value, limit } } as const);
  }

  return assertNever(requirement);
}

export function has(
  account: Pick<AccountMe, "planType" | "planStatus" | "featureFlags">,
  requirement: HasCheck,
) {
  return check(account, requirement).ok;
}

export function createHas(account: Pick<AccountMe, "planType" | "planStatus" | "featureFlags">) {
  return (requirement: HasCheck) => has(account, requirement);
}

export function resolveSitePlanForAccount(planType: PlanType): SitePlan {
  return planType === "pro" || planType === "agency" ? "pro" : "starter";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled has() check: ${JSON.stringify(value)}`);
}
