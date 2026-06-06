"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_EVENTS,
  buildNavigationAnalyticsProperties,
  captureAnalyticsEvent,
  groupAnalyticsSite,
  identifyAnalyticsUser,
} from "@internal/analytics/client";

type DashboardAnalyticsIdentityProps = {
  userId: string;
  accountId?: string | null;
  actorAccountId?: string | null;
  actorRole?: string | null;
  planType?: string | null;
  planStatus?: string | null;
  workspaceAudience?: string | null;
  actingAsCustomer?: boolean | null;
};

export function DashboardAnalyticsIdentity({
  userId,
  accountId,
  actorAccountId,
  actorRole,
  planType,
  planStatus,
  workspaceAudience,
  actingAsCustomer,
}: DashboardAnalyticsIdentityProps) {
  const trackedBootstrapRef = useRef<string | null>(null);

  useEffect(() => {
    identifyAnalyticsUser({
      distinctId: userId,
      accountId,
      actorAccountId,
      actorRole,
      planType,
      planStatus,
      workspaceAudience,
      actingAsCustomer,
    });

    const bootstrapKey = JSON.stringify({
      userId,
      accountId,
      actorAccountId,
      actorRole,
      planType,
      planStatus,
      workspaceAudience,
      actingAsCustomer,
    });
    if (trackedBootstrapRef.current === bootstrapKey) {
      return;
    }
    trackedBootstrapRef.current = bootstrapKey;
    captureAnalyticsEvent(ANALYTICS_EVENTS.dashboardBootstrapped, {
      account_id: accountId,
      actor_account_id: actorAccountId,
      actor_role: actorRole,
      plan_type: planType,
      plan_status: planStatus,
      workspace_audience: workspaceAudience,
      dashboard_acting_as_customer: actingAsCustomer ?? undefined,
      feature: "dashboard_bootstrap",
      outcome: "succeeded",
      app_surface: "dashboard",
    });
  }, [
    userId,
    accountId,
    actorAccountId,
    actorRole,
    planType,
    planStatus,
    workspaceAudience,
    actingAsCustomer,
  ]);

  return null;
}

type DashboardSiteAnalyticsScopeProps = {
  siteId: string;
  accountId?: string | null;
  actorAccountId?: string | null;
  actorRole?: string | null;
  planType?: string | null;
  planStatus?: string | null;
  workspaceAudience?: string | null;
  actingAsCustomer?: boolean | null;
};

function resolveSiteRouteFeature(routeTemplate?: string | null): string {
  if (!routeTemplate) {
    return "site_unknown";
  }
  if (routeTemplate.endsWith("/pages")) {
    return "crawl_pages";
  }
  if (routeTemplate.endsWith("/history")) {
    return "deployment_history";
  }
  if (routeTemplate.endsWith("/domains")) {
    return "domain_setup";
  }
  if (routeTemplate.endsWith("/source-selection")) {
    return "source_selection";
  }
  if (routeTemplate.endsWith("/overrides")) {
    return "advanced_translation_controls";
  }
  if (routeTemplate.endsWith("/consistency")) {
    return "consistency_controls";
  }
  if (routeTemplate.endsWith("/runtime-requests")) {
    return "runtime_observation";
  }
  if (routeTemplate.endsWith("/settings")) {
    return "site_settings";
  }
  if (routeTemplate.endsWith("/quality")) {
    return "quality_controls";
  }
  if (routeTemplate.endsWith("/developer-tools")) {
    return "developer_tools";
  }
  return "site_overview";
}

export function DashboardSiteAnalyticsScope({
  siteId,
  accountId,
  actorAccountId,
  actorRole,
  planType,
  planStatus,
  workspaceAudience,
  actingAsCustomer,
}: DashboardSiteAnalyticsScopeProps) {
  const pathname = usePathname();
  const trackedRouteRef = useRef<string | null>(null);
  const routeProperties = useMemo(
    () => buildNavigationAnalyticsProperties({ pathname }),
    [pathname],
  );

  useEffect(() => {
    groupAnalyticsSite({
      siteId,
      accountId,
      actorAccountId,
      actorRole,
      planType,
      planStatus,
      workspaceAudience,
      actingAsCustomer,
    });
  }, [
    siteId,
    accountId,
    actorAccountId,
    actorRole,
    planType,
    planStatus,
    workspaceAudience,
    actingAsCustomer,
  ]);

  useEffect(() => {
    const routeTemplate =
      typeof routeProperties.route_template === "string" ? routeProperties.route_template : null;
    const captureKey = JSON.stringify({
      siteId,
      routeTemplate,
      pathname,
      accountId,
      actorAccountId,
      actorRole,
      planType,
      planStatus,
      workspaceAudience,
      actingAsCustomer,
    });
    if (trackedRouteRef.current === captureKey) {
      return;
    }
    trackedRouteRef.current = captureKey;
    captureAnalyticsEvent(ANALYTICS_EVENTS.siteDashboardViewed, {
      ...routeProperties,
      account_id: accountId,
      actor_account_id: actorAccountId,
      actor_role: actorRole,
      plan_type: planType,
      plan_status: planStatus,
      workspace_audience: workspaceAudience,
      dashboard_acting_as_customer: actingAsCustomer ?? undefined,
      site_id: siteId,
      feature: resolveSiteRouteFeature(routeTemplate),
      outcome: "viewed",
      app_surface: "dashboard",
    });
  }, [
    siteId,
    accountId,
    actorAccountId,
    actorRole,
    planType,
    planStatus,
    workspaceAudience,
    actingAsCustomer,
    pathname,
    routeProperties,
  ]);

  return null;
}
