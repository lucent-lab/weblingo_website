import "server-only";

import { createHash } from "node:crypto";

import { after } from "next/server";
import { PostHog, type EventMessage } from "posthog-node";

import { envServer } from "@internal/core/env-server";

import {
  ANALYTICS_EVENTS,
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";
import { buildCommonAnalyticsProperties } from "./envelope";

const SERVER_ANALYTICS_DISTINCT_ID = "server";

type ServerAnalyticsOptions = {
  distinctId?: string | null;
  groups?: Record<string, string | null | undefined>;
};

type SafeExceptionFrame = {
  type: string;
  value: string;
  mechanism: {
    handled: boolean;
    type: string;
  };
};

type ServerImmediateEvent = Pick<EventMessage, "distinctId" | "event" | "groups" | "properties">;

function createPostHogServerClient() {
  return new PostHog(envServer.NEXT_PUBLIC_POSTHOG_KEY, {
    host: envServer.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 3_000,
    preloadFeatureFlags: false,
    disableGeoip: true,
  });
}

function normalizeDistinctId(distinctId: string | null | undefined): string {
  if (typeof distinctId !== "string") {
    return SERVER_ANALYTICS_DISTINCT_ID;
  }
  const trimmed = distinctId.trim();
  return trimmed || SERVER_ANALYTICS_DISTINCT_ID;
}

function sanitizeGroups(
  groups: ServerAnalyticsOptions["groups"],
): Record<string, string> | undefined {
  if (!groups) {
    return undefined;
  }

  const sanitized = Object.fromEntries(
    Object.entries(groups).flatMap(([key, value]) => {
      const trimmedKey = key.trim();
      const trimmedValue = typeof value === "string" ? value.trim() : "";
      return trimmedKey && trimmedValue ? [[trimmedKey, trimmedValue]] : [];
    }),
  );

  return Object.keys(sanitized).length ? sanitized : undefined;
}

function analyticsCaptureEnabled(): boolean {
  return envServer.NEXT_PUBLIC_POSTHOG_CAPTURE === "enabled";
}

function buildServerAnalyticsProperties(
  event: AnalyticsEventName,
  properties: AnalyticsProperties,
) {
  return sanitizeAnalyticsProperties({
    ...properties,
    ...buildCommonAnalyticsProperties(event, properties),
    runtime: "server",
  });
}

function resolveErrorName(error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const trimmed = error.name.trim();
  return trimmed ? trimmed.slice(0, 80) : "Error";
}

function buildSafeAnalyticsException(): Error {
  const safeError = new Error("Server exception captured");
  safeError.name = "ServerAnalyticsException";
  return safeError;
}

function buildSafeExceptionList(error: Error): SafeExceptionFrame[] {
  return [
    {
      type: error.name,
      value: error.message,
      mechanism: {
        handled: true,
        type: "generic",
      },
    },
  ];
}

function scheduleServerAnalytics(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

export function hashAnalyticsIdentifier(namespace: string, value: string | null | undefined) {
  const normalizedNamespace = namespace.trim();
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedNamespace || !normalizedValue) {
    return null;
  }

  const digest = createHash("sha256").update(normalizedValue, "utf8").digest("hex").slice(0, 20);
  return `${normalizedNamespace}:${digest}`;
}

async function sendServerImmediateEvent(payload: ServerImmediateEvent): Promise<void> {
  try {
    const client = createPostHogServerClient();
    await client.captureImmediate(payload);
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export function captureServerAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: ServerAnalyticsOptions = {},
): void {
  if (!analyticsCaptureEnabled()) {
    return;
  }

  let payload: ServerImmediateEvent;
  try {
    payload = {
      distinctId: normalizeDistinctId(options.distinctId),
      event,
      groups: sanitizeGroups(options.groups),
      properties: buildServerAnalyticsProperties(event, properties),
    };
  } catch {
    return;
  }

  scheduleServerAnalytics(() => sendServerImmediateEvent(payload));
}

export function captureServerException(
  error: unknown,
  properties: AnalyticsProperties = {},
  options: ServerAnalyticsOptions = {},
): void {
  if (!analyticsCaptureEnabled()) {
    return;
  }

  const safeError = buildSafeAnalyticsException();
  let payload: ServerImmediateEvent;
  try {
    payload = {
      distinctId: normalizeDistinctId(options.distinctId),
      event: ANALYTICS_EVENTS.posthogException,
      properties: {
        $exception_list: buildSafeExceptionList(safeError),
        ...buildServerAnalyticsProperties(ANALYTICS_EVENTS.posthogException, {
          ...properties,
          error_name: resolveErrorName(error),
        }),
      },
    };
  } catch {
    return;
  }

  scheduleServerAnalytics(() => sendServerImmediateEvent(payload));
}
