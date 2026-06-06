"use client";

import { useEffect, useRef } from "react";

import {
  ANALYTICS_EVENTS,
  captureAnalyticsEvent,
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
