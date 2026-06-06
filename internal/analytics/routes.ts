import { i18nConfig } from "@internal/i18n/config";

const knownLocaleValues = new Set<string>(i18nConfig.locales);

export function cleanAnalyticsPathname(pathname: string | null | undefined): string {
  if (!pathname) {
    return "/";
  }

  const [withoutQuery] = pathname.split(/[?#]/, 1);
  const normalized = `/${withoutQuery.replace(/^\/+/, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");

  return normalized || "/";
}

export function splitAnalyticsPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function resolveKnownAnalyticsLocale(segments: readonly string[]): string | null {
  return knownLocaleValues.has(segments[0] ?? "") ? (segments[0] ?? null) : null;
}

export function stripAnalyticsLocalePrefix(pathname: string): string {
  const segments = splitAnalyticsPathSegments(pathname);
  if (!segments[0] || !/^[a-z]{2}(?:-[a-z0-9]{2,})?$/i.test(segments[0])) {
    return pathname;
  }

  return `/${segments.slice(1).join("/")}` || "/";
}

export function hasAnalyticsPathSegment(
  pathname: string,
  blockedSegments: readonly string[],
): boolean {
  return splitAnalyticsPathSegments(pathname).some((segment) => blockedSegments.includes(segment));
}
