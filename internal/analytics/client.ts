"use client";

import posthog from "posthog-js";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";

type AnalyticsIdentity = {
  distinctId?: string | null;
  accountId?: string | null;
  actorAccountId?: string | null;
  planType?: string | null;
  planStatus?: string | null;
  workspaceAudience?: string | null;
  actingAsCustomer?: boolean | null;
};

export {
  ANALYTICS_EVENTS,
  buildCtaAnalyticsProperties,
  buildPageAnalyticsProperties,
  buildPreviewAnalyticsProperties,
  extractLinkTargetContext,
  extractPublicUrlContext,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";

function normalizeAnalyticsText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    posthog.capture(event, sanitizeAnalyticsProperties(properties));
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (typeof window === "undefined") {
    return;
  }

  const distinctId = normalizeAnalyticsText(identity.distinctId);
  if (!distinctId) {
    return;
  }

  const accountId = normalizeAnalyticsText(identity.accountId);
  const planType = normalizeAnalyticsText(identity.planType);
  const planStatus = normalizeAnalyticsText(identity.planStatus);
  const workspaceAudience = normalizeAnalyticsText(identity.workspaceAudience);

  try {
    posthog.identify(
      distinctId,
      sanitizeAnalyticsProperties({
        account_id: accountId,
        actor_account_id: normalizeAnalyticsText(identity.actorAccountId),
        dashboard_plan_type: planType,
        dashboard_plan_status: planStatus,
        dashboard_workspace_audience: workspaceAudience,
        dashboard_acting_as_customer: identity.actingAsCustomer ?? undefined,
        dashboard_user: true,
      }),
    );

    if (accountId) {
      posthog.group(
        "account",
        accountId,
        sanitizeAnalyticsProperties({
          plan_type: planType,
          plan_status: planStatus,
          workspace_audience: workspaceAudience,
        }),
      );
    }
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    posthog.reset();
  } catch {
    // Analytics must never break user-facing flows.
  }
}
