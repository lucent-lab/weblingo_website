"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ANALYTICS_EVENTS,
  captureAnalyticsEvent,
  buildNavigationAnalyticsProperties,
} from "@internal/analytics/client";

const recentNavigationCaptures = new Map<string, number>();
const strictModeDuplicateWindowMs = 1000;

function shouldSkipRecentNavigationCapture(key: string): boolean {
  const now = Date.now();
  const lastCapturedAt = recentNavigationCaptures.get(key);
  recentNavigationCaptures.set(key, now);

  if (lastCapturedAt === undefined) {
    return false;
  }

  return now - lastCapturedAt < strictModeDuplicateWindowMs;
}

export function NavigationAnalyticsTracker() {
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
    captureAnalyticsEvent(
      ANALYTICS_EVENTS.navigationPageView,
      buildNavigationAnalyticsProperties({ pathname, searchParams }),
      { sendInstantly: true },
    );
  }, [pathname, searchParams]);

  return null;
}
