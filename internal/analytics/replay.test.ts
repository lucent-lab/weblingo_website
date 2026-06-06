import { describe, expect, it } from "vitest";

import { resolveAnalyticsReplayPolicy, shouldSampleAnalyticsReplay } from "./replay";

describe("analytics replay policy", () => {
  it("allows only public replay surfaces", () => {
    expect(resolveAnalyticsReplayPolicy("/en/pricing")).toEqual({
      allowed: true,
      surface: "anonymous_marketing",
    });
    expect(resolveAnalyticsReplayPolicy("/fr/try")).toEqual({
      allowed: true,
      surface: "pre_submit_try_flow",
    });
    expect(resolveAnalyticsReplayPolicy("/ja/checkout/success")).toEqual({
      allowed: true,
      surface: "checkout_layout",
    });
  });

  it("blocks authenticated and customer-content replay surfaces", () => {
    expect(resolveAnalyticsReplayPolicy("/dashboard")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/dashboard/sites/site_123/source-selection")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/dashboard/sites/site_123/runtime-requests")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/fixtures/showcase/acme")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/api/prospect-showcases/acme")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/ja/checkout/success?session_id=secret")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/checkout/cancel?session_id=secret")).toEqual({
      allowed: false,
      surface: "blocked",
    });
    expect(resolveAnalyticsReplayPolicy("/contact")).toEqual({
      allowed: false,
      surface: "blocked",
    });
  });

  it("uses bounded replay sampling", () => {
    expect(shouldSampleAnalyticsReplay(0, 0)).toBe(false);
    expect(shouldSampleAnalyticsReplay(1, 0.99)).toBe(true);
    expect(shouldSampleAnalyticsReplay(0.25, 0.24)).toBe(true);
    expect(shouldSampleAnalyticsReplay(0.25, 0.25)).toBe(false);
    expect(shouldSampleAnalyticsReplay(Number.NaN, 0)).toBe(false);
  });
});
