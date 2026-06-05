import { describe, expect, it } from "vitest";

import {
  resolvePreviewStatusCenterCapacityHint,
  resolvePreviewStatusCenterMessage,
} from "./status-center-i18n";
import type { PreviewStatusCenterJob } from "./status-center-store";

const messages = {
  "try.center.providerCapacityHint": "Provider capacity hint",
  "try.status.restoring": "Checking preview status...",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity",
} as const;

const t = (key: string) => messages[key as keyof typeof messages] ?? key;

function buildJob(input: Partial<PreviewStatusCenterJob>): PreviewStatusCenterJob {
  return {
    previewId: "capacity-1111-1111-1111-111111111111",
    requestKey: "v2:prospect_showcase|https%3A%2F%2Fexample.com|en|fr|",
    statusToken: "status-token",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    targetLang: "fr",
    status: "waiting_provider_capacity",
    stage: "translating",
    previewUrl: null,
    error: null,
    errorCode: null,
    errorStage: null,
    retryHint: {
      reason: "provider_capacity_wait",
      retryAfterSeconds: 30,
      emailRecommended: false,
    },
    remoteStatusVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: null,
    retryCount: 0,
    nextPollAt: Date.now() + 30_000,
    ...input,
  };
}

describe("resolvePreviewStatusCenterMessage", () => {
  it("shows provider-capacity copy for hydrated provider-capacity jobs before status is verified", () => {
    expect(resolvePreviewStatusCenterMessage(buildJob({ remoteStatusVerified: false }), t)).toBe(
      "Waiting for translation capacity",
    );
  });

  it("shows provider-capacity copy after the status is verified", () => {
    expect(resolvePreviewStatusCenterMessage(buildJob({ remoteStatusVerified: true }), t)).toBe(
      "Waiting for translation capacity",
    );
  });

  it("uses ready job messages when a terminal prospect status carries one", () => {
    expect(
      resolvePreviewStatusCenterMessage(
        buildJob({
          status: "ready",
          error: "Complete payment to continue activation.",
          remoteStatusVerified: true,
        }),
        t,
      ),
    ).toBe("Complete payment to continue activation.");
  });

  it("shows provider-capacity hints for hydrated provider-capacity jobs before status is verified", () => {
    expect(
      resolvePreviewStatusCenterCapacityHint(buildJob({ remoteStatusVerified: false }), t),
    ).toBe("Provider capacity hint");
  });
});
