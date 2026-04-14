"use client";

import posthog from "posthog-js";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";

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
