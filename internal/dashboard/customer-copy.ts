import type { Translator } from "@internal/i18n";

type CustomerParamValue = string | number | boolean | null;
type CustomerParams = Record<string, CustomerParamValue>;

const CUSTOMER_COPY_FALLBACKS: Partial<Record<string, string>> = {
  "dashboard.health.healthy.title": "Healthy",
  "dashboard.health.healthy.description": "The site is configured and ready for visitors.",
  "dashboard.health.needsSetup.title": "Setup needed",
  "dashboard.health.needsSetup.description": "Finish setup to make translated pages available.",
  "dashboard.health.inProgress.title": "Work in progress",
  "dashboard.health.inProgress.description": "WebLingo is processing recent changes.",
  "dashboard.health.degraded.title": "Needs attention",
  "dashboard.health.degraded.description": "Some customer-facing checks need attention.",
  "dashboard.health.blocked.title": "Blocked",
  "dashboard.health.blocked.description": "A billing, quota, or setup issue is blocking changes.",
  "dashboard.health.inactive.title": "Inactive",
  "dashboard.health.inactive.description": "Localization is paused for this site.",
  "dashboard.health.unknown.title": "Status unavailable",
  "dashboard.nextAction.none.title": "No action needed",
  "dashboard.nextAction.none.description": "The site is ready for the next scheduled update.",
  "dashboard.nextAction.verifyDomain.title": "Verify a domain",
  "dashboard.nextAction.verifyDomain.description":
    "Check DNS for the domain that is not verified yet.",
  "dashboard.nextAction.configureDomain.title": "Configure a domain",
  "dashboard.nextAction.configureDomain.description":
    "Connect a translated hostname before serving traffic.",
  "dashboard.nextAction.startCrawl.title": "Start a crawl",
  "dashboard.nextAction.startCrawl.description": "Refresh source pages before translating again.",
  "dashboard.nextAction.waitForCrawl.title": "Crawl running",
  "dashboard.nextAction.waitForCrawl.description": "Wait for the current crawl to finish.",
  "dashboard.nextAction.translateAndPublish.title": "Translate and publish",
  "dashboard.nextAction.translateAndPublish.description":
    "Publish updated translations for a language.",
  "dashboard.nextAction.fixBilling.title": "Update billing",
  "dashboard.nextAction.fixBilling.description": "Resolve billing before making site changes.",
  "dashboard.blockers.domainNotVerified.title": "Domain not verified",
  "dashboard.cta.verifyDomain": "Review domains",
  "dashboard.cta.configureDomain": "Review domains",
  "dashboard.cta.startCrawl": "Review pages",
  "dashboard.cta.translateAndPublish": "Review pages",
  "dashboard.cta.fixBilling": "Update billing",
  "dashboard.status.serving.not_configured.title": "Not configured",
  "dashboard.status.serving.needs_domain.title": "Needs domain",
  "dashboard.status.serving.ready.title": "Ready",
  "dashboard.status.serving.live.title": "Live",
  "dashboard.status.serving.degraded.title": "Degraded",
  "dashboard.status.serving.disabled.title": "Disabled",
  "dashboard.status.serving.inactive.title": "Inactive",
  "dashboard.status.serving.blocked.title": "Blocked",
  "dashboard.status.serving.unknown.title": "Unknown",
  "dashboard.quotas.locales": "Locales",
};

export function formatCustomerCopy(
  t: Translator,
  key: string,
  options?: { fallback?: string; params?: CustomerParams },
): string {
  return t(
    key,
    options?.fallback ?? CUSTOMER_COPY_FALLBACKS[key] ?? humanizeCustomerKey(key),
    stringifyCustomerParams(options?.params),
  );
}

export function formatCustomerStatusValue(value: string): string {
  return humanizeIdentifier(value);
}

export function formatNullableDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString();
}

function stringifyCustomerParams(params?: CustomerParams): Record<string, string> | undefined {
  if (!params) {
    return undefined;
  }
  const entries = Object.entries(params).map(([key, value]) => [
    key,
    value == null ? "" : String(value),
  ]);
  return Object.fromEntries(entries);
}

function humanizeCustomerKey(key: string): string {
  const lastSegment = key.split(".").at(-1);
  return lastSegment ? humanizeIdentifier(lastSegment) : key;
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}
