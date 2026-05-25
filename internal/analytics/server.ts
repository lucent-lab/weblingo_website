import "server-only";

import { createHash } from "node:crypto";

import { PostHog } from "posthog-node";

import { envServer } from "@internal/core/env-server";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "./events";

const SERVER_ANALYTICS_DISTINCT_ID = "server";
const POSTHOG_SHUTDOWN_TIMEOUT_MS = 1_000;

type ServerAnalyticsOptions = {
  distinctId?: string | null;
  groups?: Record<string, string | null | undefined>;
};

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

function shutdownPostHog(client: PostHog): void {
  void client.shutdown(POSTHOG_SHUTDOWN_TIMEOUT_MS).catch(() => {
    // Analytics must never break user-facing flows.
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

export function hashAnalyticsIdentifier(namespace: string, value: string | null | undefined) {
  const normalizedNamespace = namespace.trim();
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedNamespace || !normalizedValue) {
    return null;
  }

  const digest = createHash("sha256").update(normalizedValue, "utf8").digest("hex").slice(0, 20);
  return `${normalizedNamespace}:${digest}`;
}

export async function captureServerAnalyticsEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options: ServerAnalyticsOptions = {},
): Promise<void> {
  try {
    const client = createPostHogServerClient();
    client.capture({
      distinctId: normalizeDistinctId(options.distinctId),
      event,
      groups: sanitizeGroups(options.groups),
      properties: sanitizeAnalyticsProperties({
        ...properties,
        runtime: "server",
      }),
    });
    shutdownPostHog(client);
  } catch {
    // Analytics must never break user-facing flows.
  }
}

export async function captureServerException(
  error: unknown,
  properties: AnalyticsProperties = {},
  options: ServerAnalyticsOptions = {},
): Promise<void> {
  try {
    const client = createPostHogServerClient();
    client.captureException(
      buildSafeAnalyticsException(),
      normalizeDistinctId(options.distinctId),
      sanitizeAnalyticsProperties({
        ...properties,
        error_name: resolveErrorName(error),
        runtime: "server",
      }),
    );
    shutdownPostHog(client);
  } catch {
    // Analytics must never break user-facing flows.
  }
}
