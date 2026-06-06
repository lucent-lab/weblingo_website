"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_EVENTS,
  buildNavigationAnalyticsProperties,
  captureAnalyticsEvent,
  groupAnalyticsSite,
} from "@internal/analytics/client";
import { resolveDashboardRouteFeature } from "@internal/analytics/navigation";

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
      feature: resolveDashboardRouteFeature(routeTemplate),
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
