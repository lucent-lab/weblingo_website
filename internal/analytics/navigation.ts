import { i18nConfig } from "@internal/i18n";

import { buildPageAnalyticsProperties, type AnalyticsProperties } from "./events";

type NavigationAnalyticsInput = {
  pathname: string | null;
  searchParams?: URLSearchParams | null;
};

const localeValues = new Set<string>(i18nConfig.locales);

function cleanPathname(pathname: string | null): string {
  if (!pathname) {
    return "/";
  }

  const [withoutQuery] = pathname.split(/[?#]/, 1);
  const normalized = `/${withoutQuery.replace(/^\/+/, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");

  return normalized || "/";
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isOpaqueSegment(value: string): boolean {
  if (!value) {
    return false;
  }

  if (/^\d+$/.test(value) || isUuidLike(value)) {
    return true;
  }

  return value.length >= 12 && /^[a-z0-9_-]+$/i.test(value) && /\d/.test(value);
}

function normalizePublicSegment(value: string): string {
  if (isOpaqueSegment(value)) {
    return "[id]";
  }

  return value;
}

function resolveRouteArea(segments: string[], locale: string | null): string {
  const firstSegment = segments[0] ?? "";
  const routeStart = locale ? (segments[1] ?? "") : firstSegment;

  if (firstSegment === "dashboard" || routeStart === "dashboard") {
    return "dashboard";
  }

  if (
    firstSegment === "auth" ||
    firstSegment === "login" ||
    routeStart === "auth" ||
    routeStart === "login"
  ) {
    return "auth";
  }

  if (routeStart === "docs" || routeStart === "blog") {
    return "docs";
  }

  if (routeStart === "legal") {
    return "legal";
  }

  if (routeStart === "landing" || routeStart === "landing-variant") {
    return "landing";
  }

  if (routeStart === "pricing" || routeStart === "try" || routeStart === "contact") {
    return "marketing";
  }

  return "marketing";
}

function templateDashboardRoute(segments: string[]): string {
  if (segments[0] !== "dashboard") {
    return `/${segments.join("/")}`;
  }

  if (segments[1] === "sites" && segments[2] && segments[2] !== "new") {
    return `/${["dashboard", "sites", "[id]", ...segments.slice(3)].join("/")}`;
  }

  if (segments[1] === "ops" && segments[2] === "accounts" && segments[3]) {
    return `/${["dashboard", "ops", "accounts", "[accountId]", ...segments.slice(4)].join("/")}`;
  }

  if (segments[1] === "ops" && segments[2] === "previews" && segments[3]) {
    return `/${["dashboard", "ops", "previews", "[previewId]", ...segments.slice(4)].join("/")}`;
  }

  return `/${segments.map(normalizePublicSegment).join("/")}`;
}

function templateLocalizedRoute(segments: string[], locale: string | null): string {
  const templateSegments = segments.map(normalizePublicSegment);
  if (locale) {
    templateSegments[0] = "[locale]";
  }

  const routeOffset = locale ? 1 : 0;

  if (templateSegments[routeOffset] === "blog" && templateSegments[routeOffset + 1]) {
    templateSegments[routeOffset + 1] = "[slug]";
  }

  if (templateSegments[routeOffset] === "docs" && templateSegments[routeOffset + 1]) {
    templateSegments.splice(
      routeOffset + 1,
      templateSegments.length - routeOffset - 1,
      "[...slug]",
    );
  }

  if (templateSegments[routeOffset] === "landing" && templateSegments[routeOffset + 1]) {
    templateSegments[routeOffset + 1] = "[segment]";
  }

  if (templateSegments[routeOffset] === "landing-variant" && templateSegments[routeOffset + 1]) {
    templateSegments[routeOffset + 1] = "[variant]";
  }

  return `/${templateSegments.join("/")}`;
}

function resolveRouteDetails({
  routeArea,
  routeTemplate,
  searchParams,
  segments,
}: {
  routeArea: string;
  routeTemplate: string;
  searchParams?: URLSearchParams | null;
  segments: string[];
}): Pick<
  Parameters<typeof buildPageAnalyticsProperties>[0],
  "pageType" | "segment" | "sessionPresent" | "variant"
> {
  if (routeTemplate.endsWith("/pricing")) {
    return { pageType: "pricing" };
  }

  if (routeTemplate.endsWith("/try")) {
    return { pageType: "try" };
  }

  if (routeTemplate.endsWith("/contact")) {
    return { pageType: "contact" };
  }

  if (routeTemplate.endsWith("/checkout/success")) {
    return {
      pageType: "checkout_success",
      sessionPresent: searchParams?.has("session_id") ?? false,
    };
  }

  if (routeTemplate.endsWith("/checkout/cancel")) {
    return { pageType: "checkout_cancel" };
  }

  if (routeTemplate.endsWith("/landing/[segment]")) {
    const segment = segments.at(-1) ?? null;
    return {
      pageType: "landing",
      segment,
      variant: segment === "expansion" ? "expansion" : undefined,
    };
  }

  if (routeTemplate.endsWith("/landing-variant/[variant]")) {
    return {
      pageType: "landing_variant",
      variant: segments.at(-1) ?? null,
    };
  }

  if (routeTemplate === "/[locale]" || routeTemplate === "/") {
    return { pageType: "home" };
  }

  return { pageType: routeArea };
}

export function buildNavigationAnalyticsProperties({
  pathname,
  searchParams,
}: NavigationAnalyticsInput): AnalyticsProperties {
  const pagePath = cleanPathname(pathname);
  const segments = pagePath.split("/").filter(Boolean);
  const locale = localeValues.has(segments[0] ?? "") ? (segments[0] ?? null) : null;
  const dashboardRoute = segments[0] === "dashboard";
  const routeTemplate = dashboardRoute
    ? templateDashboardRoute(segments)
    : templateLocalizedRoute(segments, locale);
  const routeArea = resolveRouteArea(segments, locale);
  const routeDetails = resolveRouteDetails({ routeArea, routeTemplate, searchParams, segments });

  return buildPageAnalyticsProperties({
    dashboardRoute,
    locale,
    pagePath: routeTemplate,
    ...routeDetails,
    routeArea,
    routeTemplate,
  });
}
