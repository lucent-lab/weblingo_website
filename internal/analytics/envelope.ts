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

export function resolveAnalyticsAppSurface(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
): string {
  if (typeof properties.app_surface === "string" && properties.app_surface.trim()) {
    return properties.app_surface.trim();
  }
  if (
    properties.dashboard_route === true ||
    properties.route_area === "dashboard" ||
    DASHBOARD_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix))
  ) {
    return "dashboard";
  }
  if (event.startsWith("auth_") || properties.route_area === "auth") {
    return "auth";
  }
  if (
    event.startsWith("checkout_") ||
    event.startsWith("stripe_") ||
    properties.page_type === "checkout_success" ||
    properties.page_type === "checkout_cancel"
  ) {
    return "checkout";
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
