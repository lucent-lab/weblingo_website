"use client";

import type { PostHogConfig } from "posthog-js";
import posthog from "posthog-js";
import { env } from "@internal/core";

import {
  ANALYTICS_EVENTS,
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type AnalyticsPropertyValue,
} from "./events";
import { buildCommonAnalyticsProperties } from "./envelope";
import { resolveAnalyticsReplayPolicy, shouldSampleAnalyticsReplay } from "./replay";

const POSTHOG_URL_PROPERTIES = [
  "$current_url",
  "$initial_current_url",
  "$referrer",
  "$initial_referrer",
  "$session_entry_url",
  "$prev_pageview_url",
] as const;

const POSTHOG_PATH_PROPERTIES = [
  "$pathname",
  "$initial_pathname",
  "$session_entry_pathname",
  "$prev_pageview_pathname",
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
let replaySampled: boolean | null = null;
let replayRecording = false;

type AnalyticsIdentity = {
  distinctId?: string | null;
  accountId?: string | null;
  actorAccountId?: string | null;
  actorRole?: string | null;
  planType?: string | null;
  planStatus?: string | null;
  workspaceAudience?: string | null;
  actingAsCustomer?: boolean | null;
};

type SiteAnalyticsIdentity = {
  siteId?: string | null;
  accountId?: string | null;
  actorAccountId?: string | null;
  actorRole?: string | null;
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
  isAnalyticsEventName,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";
export { buildNavigationAnalyticsProperties } from "./navigation";
export { resolveAnalyticsReplayPolicy, shouldSampleAnalyticsReplay } from "./replay";

function normalizeAnalyticsText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function analyticsCaptureEnabled(): boolean {
  return env.NEXT_PUBLIC_POSTHOG_CAPTURE === "enabled";
}

function analyticsReplayEnabled(): boolean {
  return (
    analyticsCaptureEnabled() &&
    env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE === "sampled" &&
    Number(env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE) > 0
  );
}

function buildCaptureProperties(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
): Record<string, Exclude<AnalyticsPropertyValue, null | undefined>> {
  return sanitizeAnalyticsProperties({
    ...properties,
    ...buildCommonAnalyticsProperties(event, properties),
  });
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

function normalizeSafeNavigationPath(properties: Record<string, unknown>): string | null {
  const pagePath = properties.page_path;
  const routeTemplate = properties.route_template;
  const candidate = typeof pagePath === "string" ? pagePath : routeTemplate;

  if (typeof candidate !== "string" || !candidate.startsWith("/")) {
    return null;
  }

  return candidate.replace(/[?#].*$/, "") || "/";
}

function rewriteUrlPath(value: unknown, safePath: string): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    const url = new URL(value);
    url.pathname = safePath;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return safePath;
  }
}

function normalizeHostProperty(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutScheme = trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return withoutScheme && !/[/?#@]/.test(withoutScheme) ? withoutScheme : null;
}

function resolveCurrentUrlProtocol(host: string): "http:" | "https:" {
  const normalizedHost = host.toLowerCase();
  if (
    typeof window !== "undefined" &&
    window.location.host.toLowerCase() === normalizedHost &&
    (window.location.protocol === "http:" || window.location.protocol === "https:")
  ) {
    return window.location.protocol;
  }

  try {
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    if (
      appUrl.host.toLowerCase() === normalizedHost &&
      (appUrl.protocol === "http:" || appUrl.protocol === "https:")
    ) {
      return appUrl.protocol;
    }
  } catch {
    // Fall back to the production-safe scheme below.
  }

  return "https:";
}

function buildSafeCurrentUrl(properties: Record<string, unknown>, safePath: string): string {
  const currentUrl = properties.$current_url;
  if (typeof currentUrl === "string") {
    return String(rewriteUrlPath(currentUrl, safePath));
  }

  const host = properties.$host;
  if (typeof host === "string" && host.trim()) {
    const safeHost = normalizeHostProperty(host);
    if (safeHost) {
      return `${resolveCurrentUrlProtocol(safeHost)}//${safeHost}${safePath}`;
    }
  }

  try {
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    appUrl.pathname = safePath;
    appUrl.search = "";
    appUrl.hash = "";
    return appUrl.toString();
  } catch {
    return safePath;
  }
}

const sanitizePostHogCaptureResult: AnalyticsBeforeSend = (result) => {
  if (result === null) {
    return null;
  }

  const safeNavigationPath = normalizeSafeNavigationPath(result.properties);

  for (const property of POSTHOG_URL_PROPERTIES) {
    if (property in result.properties) {
      result.properties[property] =
        safeNavigationPath === null
          ? stripUrlQueryAndHash(result.properties[property])
          : rewriteUrlPath(result.properties[property], safeNavigationPath);
    }
  }

  if (safeNavigationPath !== null) {
    result.properties.$current_url = buildSafeCurrentUrl(result.properties, safeNavigationPath);
    result.properties.$pathname = safeNavigationPath;

    for (const property of POSTHOG_PATH_PROPERTIES) {
      if (property in result.properties) {
        result.properties[property] = safeNavigationPath;
      }
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
    disable_session_recording: true,
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
      sampleRate: Number(env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE),
    },
    before_send: sanitizePostHogCaptureResult,
  };
}

export function initializeAnalytics(): void {
  if (analyticsInitialized || typeof window === "undefined" || !analyticsCaptureEnabled()) {
    return;
  }

  try {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, buildAnalyticsInitConfig());
    analyticsInitialized = true;
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function syncAnalyticsSessionReplayForPath(pathname: string | null | undefined): void {
  if (typeof window === "undefined" || !analyticsReplayEnabled()) {
    return;
  }

  try {
    const policy = resolveAnalyticsReplayPolicy(pathname);
    if (!policy.allowed) {
      if (replayRecording) {
        posthog.stopSessionRecording();
        replayRecording = false;
      }
      return;
    }

    initializeAnalytics();
    if (replaySampled === null) {
      replaySampled = shouldSampleAnalyticsReplay(
        Number(env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE),
        Math.random(),
      );
    }
    if (!replaySampled) {
      return;
    }
    if (!replayRecording) {
      posthog.startSessionRecording({ sampling: true });
      replayRecording = true;
    }
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: { sendInstantly?: boolean } = {},
): void {
  if (typeof window === "undefined" || !analyticsCaptureEnabled()) {
    return;
  }

  try {
    initializeAnalytics();
    posthog.capture(
      event,
      buildCaptureProperties(event, properties),
      options.sendInstantly === true ? { send_instantly: true } : undefined,
    );
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function identifyAnalyticsUser(identity: AnalyticsIdentity): void {
  if (typeof window === "undefined" || !analyticsCaptureEnabled()) {
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
        ...buildCommonAnalyticsProperties(ANALYTICS_EVENTS.accountIdentified, {
          app_surface: "dashboard",
        }),
        account_id: accountId,
        actor_account_id: normalizeAnalyticsText(identity.actorAccountId),
        actor_role: normalizeAnalyticsText(identity.actorRole),
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
          ...buildCommonAnalyticsProperties(ANALYTICS_EVENTS.accountIdentified, {
            app_surface: "dashboard",
          }),
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

export function groupAnalyticsSite(identity: SiteAnalyticsIdentity): void {
  if (typeof window === "undefined" || !analyticsCaptureEnabled()) {
    return;
  }

  const siteId = normalizeAnalyticsText(identity.siteId);
  if (!siteId) {
    return;
  }

  initializeAnalytics();

  try {
    posthog.group(
      "site",
      siteId,
      sanitizeAnalyticsProperties({
        ...buildCommonAnalyticsProperties(ANALYTICS_EVENTS.siteDashboardViewed, {
          app_surface: "dashboard",
        }),
        account_id: normalizeAnalyticsText(identity.accountId),
        actor_account_id: normalizeAnalyticsText(identity.actorAccountId),
        actor_role: normalizeAnalyticsText(identity.actorRole),
        plan_type: normalizeAnalyticsText(identity.planType),
        plan_status: normalizeAnalyticsText(identity.planStatus),
        workspace_audience: normalizeAnalyticsText(identity.workspaceAudience),
        dashboard_acting_as_customer: identity.actingAsCustomer ?? undefined,
      }),
    );
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined" || !analyticsCaptureEnabled()) {
    return;
  }

  try {
    initializeAnalytics();
    posthog.reset();
  } catch {
    // Analytics must never break user-facing flows.
  }
}
