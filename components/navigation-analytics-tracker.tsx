"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_EVENTS,
  captureAnalyticsEvent,
  buildNavigationAnalyticsProperties,
  syncAnalyticsSessionReplayForPath,
} from "@internal/analytics/client";

const recentNavigationCaptures = new Map<string, number>();
const strictModeDuplicateWindowMs = 1000;
const maxRecentNavigationCaptures = 50;

function shouldSkipRecentNavigationCapture(key: string): boolean {
  const now = Date.now();
  const lastCapturedAt = recentNavigationCaptures.get(key);
  if (lastCapturedAt !== undefined) {
    recentNavigationCaptures.delete(key);
  }
  recentNavigationCaptures.set(key, now);
  while (recentNavigationCaptures.size > maxRecentNavigationCaptures) {
    const oldestKey = recentNavigationCaptures.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    recentNavigationCaptures.delete(oldestKey);
  }

  if (lastCapturedAt === undefined) {
    return false;
  }

  return now - lastCapturedAt < strictModeDuplicateWindowMs;
}

type NavigationAnalyticsTrackerProps = {
  homePageVariant?: "classic" | "expansion";
};

export function NavigationAnalyticsTracker({ homePageVariant }: NavigationAnalyticsTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const captureKey = `${pathname}?session_id=${searchParams.has("session_id") ? "1" : "0"}`;
    if (
      lastTrackedPathnameRef.current === captureKey ||
      shouldSkipRecentNavigationCapture(captureKey)
    ) {
      return;
    }

    lastTrackedPathnameRef.current = captureKey;
    const replayPath = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    const properties = buildNavigationAnalyticsProperties({
      homePageVariant,
      pathname,
      searchParams,
    });
    syncAnalyticsSessionReplayForPath(replayPath);
    captureAnalyticsEvent(ANALYTICS_EVENTS.posthogPageView, properties, { sendInstantly: true });
  }, [homePageVariant, pathname, searchParams]);

  return null;
}
