type ReplaySurface =
  | "anonymous_marketing"
  | "checkout_layout"
  | "pre_submit_try_flow"
  | "sanitized_support"
  | "blocked";

export type AnalyticsReplayPolicy = {
  allowed: boolean;
  surface: ReplaySurface;
};

const BLOCKED_PREFIXES = [
  "/_analytics",
  "/api",
  "/dashboard",
  "/demo-dashboard",
  "/fixtures/customer-seo",
  "/fixtures/showcase",
  "/prospect-showcases",
] as const;

const BLOCKED_SEGMENTS = [
  "admin",
  "glossary",
  "overrides",
  "runtime-requests",
  "source-selection",
  "translation",
] as const;

function cleanPathname(pathname: string | null | undefined): string {
  if (!pathname) {
    return "/";
  }
  const [withoutQuery] = pathname.split(/[?#]/, 1);
  const normalized = `/${withoutQuery.replace(/^\/+/, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
  return normalized || "/";
}

function hasQueryString(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string") {
    return false;
  }
  const queryStart = pathname.indexOf("?");
  if (queryStart === -1) {
    return false;
  }
  const hashStart = pathname.indexOf("#", queryStart);
  const query = pathname.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart);
  return query.trim().length > 0;
}

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && /^[a-z]{2}(?:-[a-z0-9]{2,})?$/i.test(segments[0])) {
    return `/${segments.slice(1).join("/")}` || "/";
  }
  return pathname;
}

function hasBlockedSegment(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.some((segment) =>
    BLOCKED_SEGMENTS.includes(segment as (typeof BLOCKED_SEGMENTS)[number]),
  );
}

export function resolveAnalyticsReplayPolicy(pathname: string | null | undefined) {
  const cleaned = cleanPathname(pathname);
  const unlocalized = stripLocalePrefix(cleaned);

  if (
    BLOCKED_PREFIXES.some((prefix) => cleaned === prefix || cleaned.startsWith(`${prefix}/`)) ||
    hasBlockedSegment(cleaned)
  ) {
    return { allowed: false, surface: "blocked" } satisfies AnalyticsReplayPolicy;
  }

  if (unlocalized === "/checkout/success" || unlocalized === "/checkout/cancel") {
    if (hasQueryString(pathname)) {
      return { allowed: false, surface: "blocked" } satisfies AnalyticsReplayPolicy;
    }
    return { allowed: true, surface: "checkout_layout" } satisfies AnalyticsReplayPolicy;
  }

  if (unlocalized === "/try") {
    return { allowed: true, surface: "pre_submit_try_flow" } satisfies AnalyticsReplayPolicy;
  }

  if (unlocalized === "/contact") {
    return { allowed: true, surface: "sanitized_support" } satisfies AnalyticsReplayPolicy;
  }

  if (
    unlocalized === "/" ||
    unlocalized === "/pricing" ||
    unlocalized.startsWith("/landing/") ||
    unlocalized.startsWith("/landing-variant/") ||
    unlocalized.startsWith("/docs") ||
    unlocalized.startsWith("/blog") ||
    unlocalized.startsWith("/legal")
  ) {
    return { allowed: true, surface: "anonymous_marketing" } satisfies AnalyticsReplayPolicy;
  }

  return { allowed: false, surface: "blocked" } satisfies AnalyticsReplayPolicy;
}

export function shouldSampleAnalyticsReplay(sampleRate: number, randomValue: number): boolean {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return false;
  }
  if (sampleRate >= 1) {
    return true;
  }
  return randomValue < sampleRate;
}
