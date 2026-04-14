"use client";

import { useEffect, useRef } from "react";

import {
  captureAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@internal/analytics/client";

const RECENT_PAGE_VIEW_DEDUPE_WINDOW_MS = 1000;
const recentPageViewKeys = new Map<string, number>();

type AnalyticsPageViewProps = {
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
};

function createPageViewKey(event: AnalyticsEventName, properties: AnalyticsProperties): string {
  return JSON.stringify([
    event,
    Object.entries(properties).sort(([left], [right]) => left.localeCompare(right)),
  ]);
}

export function AnalyticsPageView({ event, properties = {} }: AnalyticsPageViewProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    const now = Date.now();
    const dedupeKey = createPageViewKey(event, properties);
    const previousTs = recentPageViewKeys.get(dedupeKey);

    if (typeof previousTs === "number" && now - previousTs < RECENT_PAGE_VIEW_DEDUPE_WINDOW_MS) {
      return;
    }

    recentPageViewKeys.set(dedupeKey, now);
    captureAnalyticsEvent(event, properties);
  }, [event, properties]);

  return null;
}
