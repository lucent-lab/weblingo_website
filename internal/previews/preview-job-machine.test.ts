import { describe, expect, it } from "vitest";
import {
  parsePreviewRetryHint,
  reducePreviewJob,
  resolveNextPreviewJobPhase,
  type PreviewJob,
} from "./preview-job-machine";

function buildJob(overrides: Partial<PreviewJob> = {}): PreviewJob {
  const now = 1_000;
  return {
    previewId: "11111111-1111-1111-1111-111111111111",
    requestKey: "v2:prospect_showcase|https%3A%2F%2Fexample.com|en|fr|",
    statusToken: "status-token",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    targetLang: "fr",
    status: "pending",
    stage: null,
    previewUrl: null,
    error: null,
    errorCode: null,
    errorStage: null,
    retryHint: null,
    remoteStatusVerified: true,
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    retryCount: 0,
    nextPollAt: now + 5_000,
    ...overrides,
  };
}

describe("preview-job-machine", () => {
  it("prevents backward status transitions", () => {
    const current = buildJob({ status: "processing" });
    const next = reducePreviewJob(
      current,
      {
        type: "patch",
        patch: {
          status: "pending",
        },
      },
      {
        now: 2_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(next).not.toBeNull();
    expect(next?.status).toBe("processing");
  });

  it("keeps terminal states absorbing", () => {
    const current = buildJob({
      status: "failed",
      errorCode: "unknown",
      error: "Preview failed",
      stage: null,
    });

    const patched = reducePreviewJob(
      current,
      {
        type: "patch",
        patch: {
          status: "processing",
          stage: "translating",
          error: null,
          errorCode: null,
        },
      },
      {
        now: 2_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(patched).not.toBeNull();
    expect(patched?.status).toBe("failed");
    expect(patched?.nextPollAt).toBe(Number.POSITIVE_INFINITY);

    const terminalAgain = reducePreviewJob(
      patched,
      {
        type: "terminal",
        status: "ready",
      },
      {
        now: 3_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(terminalAgain?.status).toBe("failed");
  });

  it("applies stage transitions monotonically", () => {
    const current = buildJob({
      status: "processing",
      stage: "translating",
    });

    const downgraded = reducePreviewJob(
      current,
      {
        type: "patch",
        patch: {
          stage: "analyzing_content",
        },
      },
      {
        now: 2_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(downgraded?.stage).toBe("translating");

    const upgraded = reducePreviewJob(
      downgraded,
      {
        type: "patch",
        patch: {
          stage: "saving",
        },
      },
      {
        now: 3_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(upgraded?.stage).toBe("saving");

    const terminal = reducePreviewJob(
      upgraded,
      {
        type: "terminal",
        status: "ready",
      },
      {
        now: 4_000,
        defaultPollIntervalMs: 5_000,
      },
    );

    expect(terminal?.stage).toBeNull();
    expect(terminal?.status).toBe("ready");
  });

  it("keeps active phase progression while allowing capacity waits to resume", () => {
    expect(resolveNextPreviewJobPhase("pending", "processing")).toBe("processing");
    expect(resolveNextPreviewJobPhase("processing", "waiting_provider_capacity")).toBe(
      "waiting_provider_capacity",
    );
    expect(resolveNextPreviewJobPhase("waiting_provider_capacity", "processing")).toBe(
      "processing",
    );
    expect(resolveNextPreviewJobPhase("processing", "pending")).toBe("processing");
  });

  it("rejects invalid retry hints with fractional or negative retry seconds", () => {
    expect(
      parsePreviewRetryHint({
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 1.5,
      }),
    ).toEqual({
      reason: "browser_capacity_exhausted",
      retryAfterSeconds: null,
    });
    expect(
      parsePreviewRetryHint({
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: -1,
      }),
    ).toEqual({
      reason: "browser_capacity_exhausted",
      retryAfterSeconds: null,
    });
    expect(
      parsePreviewRetryHint({
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 60,
      }),
    ).toEqual({
      reason: "browser_capacity_exhausted",
      retryAfterSeconds: 60,
    });
    expect(
      parsePreviewRetryHint({
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
      }),
    ).toEqual({
      reason: "provider_capacity_wait",
      retryAfterSeconds: 30,
    });
  });

  it("ignores legacy emailRecommended fields in retry hint payloads", () => {
    expect(
      parsePreviewRetryHint({
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 60,
        emailRecommended: true,
      }),
    ).toEqual({
      reason: "browser_capacity_exhausted",
      retryAfterSeconds: 60,
    });
  });

  it("stamps lastVerifiedAt only when the remote status is verified", () => {
    const unverified = reducePreviewJob(
      buildJob({ remoteStatusVerified: true, lastVerifiedAt: 1_000 }),
      {
        type: "patch",
        patch: {
          remoteStatusVerified: false,
        },
      },
      {
        now: 2_000,
        defaultPollIntervalMs: 5_000,
      },
    );
    expect(unverified?.lastVerifiedAt).toBe(1_000);

    const reverified = reducePreviewJob(
      unverified,
      {
        type: "patch",
        patch: {
          remoteStatusVerified: true,
        },
      },
      {
        now: 3_000,
        defaultPollIntervalMs: 5_000,
      },
    );
    expect(reverified?.lastVerifiedAt).toBe(3_000);
  });
});
