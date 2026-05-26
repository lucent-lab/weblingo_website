"use client";

import { useEffect } from "react";

import { identifyAnalyticsUser } from "@internal/analytics/client";

type DashboardAnalyticsIdentityProps = {
  userId: string;
  accountId?: string | null;
  actorAccountId?: string | null;
  planType?: string | null;
  planStatus?: string | null;
  workspaceAudience?: string | null;
  actingAsCustomer?: boolean | null;
};

export function DashboardAnalyticsIdentity({
  userId,
  accountId,
  actorAccountId,
  planType,
  planStatus,
  workspaceAudience,
  actingAsCustomer,
}: DashboardAnalyticsIdentityProps) {
  useEffect(() => {
    identifyAnalyticsUser({
      distinctId: userId,
      accountId,
      actorAccountId,
      planType,
      planStatus,
      workspaceAudience,
      actingAsCustomer,
    });
  }, [
    userId,
    accountId,
    actorAccountId,
    planType,
    planStatus,
    workspaceAudience,
    actingAsCustomer,
  ]);

  return null;
}
