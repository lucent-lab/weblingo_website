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

function hashNavigationQuery(searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  if (!query) {
    return "none";
  }

  let hash = 2_166_136_261;
  for (let index = 0; index < query.length; index += 1) {
    hash ^= query.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
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

    const querySignature = hashNavigationQuery(searchParams);
    const captureKey = `${pathname}?query=${querySignature}&session_id=${searchParams.has("session_id") ? "1" : "0"}`;
    if (
      lastTrackedPathnameRef.current === captureKey ||
      shouldSkipRecentNavigationCapture(captureKey)
    ) {
      return;
    }

    lastTrackedPathnameRef.current = captureKey;
    const replayPath = querySignature === "none" ? pathname : `${pathname}?query=present`;
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
