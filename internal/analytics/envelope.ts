import type { AnalyticsEventName, AnalyticsProperties } from "./events";

const DASHBOARD_EVENT_PREFIXES = [
  "dashboard_",
  "site_",
  "domain_",
  "crawl_",
  "translation_",
  "glossary_",
  "override_",
  "source_selection_",
  "locale_serving_",
  "quota_",
  "workspace_",
] as const;

type RouteAppSurface = "api" | "auth" | "checkout" | "dashboard" | "marketing";

export function resolveAnalyticsEnvironment(): string {
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  if (process.env.NODE_ENV === "test") {
    return "test";
  }
  return "development";
}

export function resolveAnalyticsDeploymentChannel(): string {
  const channel =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() || process.env.VERCEL_ENV?.trim() || "";
  if (channel === "production" || channel === "preview" || channel === "development") {
    return channel;
  }
  if (process.env.NODE_ENV === "test") {
    return "test";
  }
  if (process.env.NODE_ENV === "development") {
    return "local";
  }
  return "unknown";
}

function normalizeRouteText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveAnalyticsRouteSurface(properties: AnalyticsProperties): RouteAppSurface | null {
  const routeArea = normalizeRouteText(properties.route_area);
  if (
    routeArea === "api" ||
    routeArea === "auth" ||
    routeArea === "checkout" ||
    routeArea === "dashboard" ||
    routeArea === "marketing"
  ) {
    return routeArea;
  }
  if (routeArea === "docs" || routeArea === "landing") {
    return "marketing";
  }

  const routeTemplate = normalizeRouteText(properties.route_template);
  if (!routeTemplate) {
    return null;
  }
  if (routeTemplate === "/dashboard" || routeTemplate.startsWith("/dashboard/")) {
    return "dashboard";
  }
  if (
    routeTemplate === "/auth" ||
    routeTemplate.startsWith("/auth/") ||
    routeTemplate === "/login" ||
    routeTemplate.startsWith("/login/") ||
    routeTemplate === "/signup" ||
    routeTemplate.startsWith("/signup/")
  ) {
    return "auth";
  }
  if (routeTemplate === "/api" || routeTemplate.startsWith("/api/")) {
    return "api";
  }
  if (routeTemplate === "/checkout" || routeTemplate.startsWith("/checkout/")) {
    return "checkout";
  }
  return null;
}

export function resolveAnalyticsAppSurface(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
): string {
  if (typeof properties.app_surface === "string" && properties.app_surface.trim()) {
    return properties.app_surface.trim();
  }
  const routeSurface = resolveAnalyticsRouteSurface(properties);
  if (
    properties.dashboard_route === true ||
    routeSurface === "dashboard" ||
    DASHBOARD_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix))
  ) {
    return "dashboard";
  }
  if (event.startsWith("auth_") || routeSurface === "auth") {
    return "auth";
  }
  if (
    event.startsWith("checkout_") ||
    event.startsWith("stripe_") ||
    routeSurface === "checkout" ||
    properties.page_type === "checkout_success" ||
    properties.page_type === "checkout_cancel"
  ) {
    return "checkout";
  }
  if (routeSurface) {
    return routeSurface;
  }
  return "marketing";
}

export function buildCommonAnalyticsProperties(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
): AnalyticsProperties {
  return {
    environment: resolveAnalyticsEnvironment(),
    repo: "weblingo_website",
    app_surface: resolveAnalyticsAppSurface(event, properties),
    deployment_channel: resolveAnalyticsDeploymentChannel(),
  };
}
