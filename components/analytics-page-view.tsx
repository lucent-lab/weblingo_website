"use client";

import { useEffect, useRef } from "react";

import {
  captureAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@internal/analytics/client";

type AnalyticsPageViewProps = {
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
};

export function AnalyticsPageView({ event, properties = {} }: AnalyticsPageViewProps) {
  const trackedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    timeoutRef.current = setTimeout(() => {
      captureAnalyticsEvent(event, properties);
      timeoutRef.current = null;
    }, 0);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [event, properties]);

  return null;
}
