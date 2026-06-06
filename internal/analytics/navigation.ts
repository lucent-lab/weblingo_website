import { buildPageAnalyticsProperties, type AnalyticsProperties } from "./events";
import {
  cleanAnalyticsPathname,
  resolveKnownAnalyticsLocale,
  splitAnalyticsPathSegments,
} from "./routes";

type NavigationAnalyticsInput = {
  homePageVariant?: "classic" | "expansion";
  pathname: string | null;
  searchParams?: URLSearchParams | null;
};

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

  return `/${segments.map(normalizePublicSegment).join("/")}`;
}

function prefixLocalizedRouteTemplate(routeTemplate: string): string {
  const segments = routeTemplate.replace(/^\/+/, "").split("/").filter(Boolean);
  return `/${["[locale]", ...segments].join("/")}`;
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
  homePageVariant,
}: {
  homePageVariant?: "classic" | "expansion";
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
    if (homePageVariant === "expansion") {
      return {
        pageType: "landing",
        segment: "expansion",
        variant: "expansion",
      };
    }

    return { pageType: "home", variant: "classic" };
  }

  return { pageType: routeArea };
}

const DASHBOARD_ROUTE_FEATURE_SUFFIXES = [
  ["/pages", "crawl_pages"],
  ["/history", "deployment_history"],
  ["/domains", "domain_setup"],
  ["/source-selection", "source_selection"],
  ["/overrides", "advanced_translation_controls"],
  ["/consistency", "consistency_controls"],
  ["/runtime-requests", "runtime_observation"],
  ["/settings", "site_settings"],
  ["/quality", "quality_controls"],
  ["/developer-tools", "developer_tools"],
] as const;

export function resolveDashboardRouteFeature(routeTemplate?: string | null): string {
  if (!routeTemplate) {
    return "site_unknown";
  }

  for (const [suffix, feature] of DASHBOARD_ROUTE_FEATURE_SUFFIXES) {
    if (routeTemplate.endsWith(suffix)) {
      return feature;
    }
  }

  return "site_overview";
}

export function buildNavigationAnalyticsProperties({
  homePageVariant,
  pathname,
  searchParams,
}: NavigationAnalyticsInput): AnalyticsProperties {
  const pagePath = cleanAnalyticsPathname(pathname);
  const segments = splitAnalyticsPathSegments(pagePath);
  const locale = resolveKnownAnalyticsLocale(segments);
  const localizedDashboardRoute = locale !== null && segments[1] === "dashboard";
  const dashboardSegments = localizedDashboardRoute ? segments.slice(1) : segments;
  const dashboardRoute = dashboardSegments[0] === "dashboard";
  const routeTemplate = dashboardRoute
    ? localizedDashboardRoute
      ? prefixLocalizedRouteTemplate(templateDashboardRoute(dashboardSegments))
      : templateDashboardRoute(dashboardSegments)
    : templateLocalizedRoute(segments, locale);
  const routeArea = resolveRouteArea(segments, locale);
  const routeDetails = resolveRouteDetails({
    homePageVariant,
    routeArea,
    routeTemplate,
    searchParams,
    segments,
  });

  return buildPageAnalyticsProperties({
    dashboardRoute,
    locale,
    pagePath: dashboardRoute ? routeTemplate : pagePath,
    ...routeDetails,
    routeArea,
    routeTemplate,
  });
}
