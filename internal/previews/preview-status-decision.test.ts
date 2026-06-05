import { describe, expect, it } from "vitest";

import { resolvePreviewStatusDecision } from "./preview-status-decision";

describe("resolvePreviewStatusDecision", () => {
  it.each(["checkout_pending", "activation_pending", "converted"])(
    "keeps prospect showcase conversion status %s active",
    (status) => {
      expect(
        resolvePreviewStatusDecision({
          responseOk: true,
          responseStatus: 200,
          payload: {
            status,
            message: "Conversion state message.",
            showcaseUrl: "https://t2.weblingo.app/ps-demo/fr",
            demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
          },
          defaultErrorMessage: "Unable to check preview status.",
        }),
      ).toMatchObject({
        kind: "active",
        status: "processing",
        previewUrl: "https://t2.weblingo.app/ps-demo/fr",
        stage: null,
        remoteStatusVerified: true,
      });
    },
  );

  it("keeps prospect showcase conversion statuses active when links are absent", () => {
    const decision = resolvePreviewStatusDecision({
      responseOk: true,
      responseStatus: 200,
      payload: {
        status: "checkout_pending",
        message: "Complete payment to continue activation.",
        demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
        expiresAt: "2026-06-02T10:00:00.000Z",
      },
      defaultErrorMessage: "Unable to check preview status.",
    });

    expect(decision).toMatchObject({
      kind: "active",
      status: "processing",
      expiresAt: Date.parse("2026-06-02T10:00:00.000Z"),
      remoteStatusVerified: true,
    });
    expect(decision).toHaveProperty("previewUrl", undefined);
  });

  it("terminalizes prospect showcase payment_failed as failed", () => {
    expect(
      resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: {
          status: "payment_failed",
          message: "Payment failed. Retry checkout to continue activation.",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
          expiresAt: "2026-06-02T10:00:00.000Z",
        },
        defaultErrorMessage: "Unable to check preview status.",
      }),
    ).toEqual({
      kind: "terminal",
      status: "failed",
      previewUrl: null,
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
      expiresAt: Date.parse("2026-06-02T10:00:00.000Z"),
      error: "Payment failed. Retry checkout to continue activation.",
      errorCode: null,
      errorStage: null,
    });
  });

  it("clears terminal failure links when the payload omits them", () => {
    expect(
      resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: {
          status: "payment_failed",
          message: "Payment failed. Retry checkout to continue activation.",
        },
        defaultErrorMessage: "Unable to check preview status.",
      }),
    ).toEqual({
      kind: "terminal",
      status: "failed",
      previewUrl: null,
      demoDashboardUrl: null,
      error: "Payment failed. Retry checkout to continue activation.",
      errorCode: null,
      errorStage: null,
    });
  });

  it("preserves prospect showcase demo dashboard links on remote expiry", () => {
    const decision = resolvePreviewStatusDecision({
      responseOk: false,
      responseStatus: 410,
      payload: null,
      defaultErrorMessage: "Unable to check preview status.",
    });

    expect(decision).toEqual({
      kind: "terminal",
      status: "expired",
      previewUrl: null,
      error: null,
      errorCode: "preview_expired",
      errorStage: null,
    });
    expect(decision).not.toHaveProperty("demoDashboardUrl");
  });

  it("preserves explicit failure links from prospect showcase payloads", () => {
    expect(
      resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: {
          status: "failed",
          message: "Payment recovery is required.",
          showcaseUrl: "https://t2.weblingo.app/ps-demo/fr",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
        },
        defaultErrorMessage: "Unable to check preview status.",
      }),
    ).toEqual({
      kind: "terminal",
      status: "failed",
      previewUrl: "https://t2.weblingo.app/ps-demo/fr",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
      error: "Payment recovery is required.",
      errorCode: null,
      errorStage: null,
    });
  });

  it("keeps unknown active statuses processing while preserving verification state", () => {
    expect(
      resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: { status: "checkout_pending" },
        defaultErrorMessage: "Unable to check preview status.",
      }),
    ).toMatchObject({
      kind: "active",
      status: "processing",
      remoteStatusVerified: true,
    });
  });
});
