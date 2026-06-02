import { describe, expect, it } from "vitest";

import { resolvePreviewStatusDecision } from "./preview-status-decision";

describe("resolvePreviewStatusDecision", () => {
  it.each(["checkout_pending", "activation_pending", "payment_failed", "converted"])(
    "terminalizes prospect showcase conversion status %s",
    (status) => {
      expect(
        resolvePreviewStatusDecision({
          responseOk: true,
          responseStatus: 200,
          payload: {
            status,
            showcaseUrl: "https://t2.weblingo.app/ps-demo/fr",
            demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
          },
          defaultErrorMessage: "Unable to check preview status.",
          payloadKind: "prospect_showcase",
        }),
      ).toEqual({
        kind: "terminal",
        status: "ready",
        previewUrl: "https://t2.weblingo.app/ps-demo/fr",
        demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
        error: null,
        errorCode: null,
        errorStage: null,
      });
    },
  );

  it("keeps generic preview unknown statuses active", () => {
    expect(
      resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: { status: "checkout_pending" },
        defaultErrorMessage: "Unable to check preview status.",
        payloadKind: "preview",
      }),
    ).toMatchObject({
      kind: "active",
      status: "processing",
      remoteStatusVerified: true,
    });
  });
});
