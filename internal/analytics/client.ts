"use client";

import type { PostHogConfig } from "posthog-js";
import posthog from "posthog-js";
import { env } from "@internal/core";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";

const POSTHOG_URL_PROPERTIES = [
  "$current_url",
  "$initial_current_url",
  "$referrer",
  "$initial_referrer",
] as const;

const POSTHOG_PROPERTY_DENYLIST = [
  "$current_url",
  "$initial_current_url",
  "$referrer",
  "$initial_referrer",
  "$referring_domain",
  "$initial_referring_domain",
] as const;

type AnalyticsInitConfig = Partial<PostHogConfig>;
type AnalyticsBeforeSend = Extract<
  NonNullable<PostHogConfig["before_send"]>,
  (...args: never[]) => unknown
>;

let analyticsInitialized = false;

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

function stripUrlQueryAndHash(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

const sanitizePostHogCaptureResult: AnalyticsBeforeSend = (result) => {
  if (result === null) {
    return null;
  }

  for (const property of POSTHOG_URL_PROPERTIES) {
    if (property in result.properties) {
      result.properties[property] = stripUrlQueryAndHash(result.properties[property]);
    }
  }

  return result;
};

export function buildAnalyticsInitConfig(): AnalyticsInitConfig {
  return {
    api_host: env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    rageclick: false,
    capture_heatmaps: false,
    capture_performance: false,
    cross_subdomain_cookie: false,
    custom_personal_data_properties: ["email", "token", "secret", "key", "password"],
    disable_persistence: true,
    enable_recording_console_log: false,
    error_tracking: {
      __capturePostHogExceptions: false,
      captureExtensionExceptions: false,
    },
    mask_all_element_attributes: true,
    mask_all_text: true,
    mask_personal_data_properties: true,
    persistence: "memory",
    person_profiles: "identified_only",
    property_denylist: [...POSTHOG_PROPERTY_DENYLIST],
    respect_dnt: true,
    save_campaign_params: false,
    save_referrer: false,
    secure_cookie: true,
    session_recording: {
      captureCanvas: {
        recordCanvas: false,
      },
      collectFonts: false,
      maskAllInputs: true,
      maskCapturedNetworkRequestFn: () => null,
      maskTextSelector: "*",
      recordBody: false,
      recordCrossOriginIframes: false,
      recordHeaders: false,
    },
    before_send: sanitizePostHogCaptureResult,
  };
}

export function initializeAnalytics(): void {
  if (analyticsInitialized || typeof window === "undefined") {
    return;
  }

  try {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, buildAnalyticsInitConfig());
    analyticsInitialized = true;
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    initializeAnalytics();
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

  initializeAnalytics();

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
    initializeAnalytics();
    posthog.reset();
  } catch {
    // Analytics must never break user-facing flows.
  }
}
