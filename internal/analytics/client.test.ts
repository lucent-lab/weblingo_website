// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

function setRequiredClientEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "https://weblingo.app";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "supabase-key";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.weblingo.app";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "5000";
}

beforeEach(() => {
  vi.resetModules();
  setRequiredClientEnv();
  posthogMock.capture.mockReset();
  posthogMock.group.mockReset();
  posthogMock.identify.mockReset();
  posthogMock.init.mockReset();
  posthogMock.reset.mockReset();
});

describe("client analytics helpers", () => {
  it("initializes PostHog with maximum privacy session replay defaults", async () => {
    const { buildAnalyticsInitConfig, initializeAnalytics } = await import("./client");

    initializeAnalytics();

    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://weblingo.app/_analytics/posthog",
        autocapture: false,
        capture_heatmaps: false,
        capture_pageleave: false,
        capture_pageview: false,
        capture_performance: false,
        cross_subdomain_cookie: false,
        disable_persistence: true,
        enable_recording_console_log: false,
        mask_all_element_attributes: true,
        mask_all_text: true,
        persistence: "memory",
        respect_dnt: true,
        save_campaign_params: false,
        save_referrer: false,
        session_recording: expect.objectContaining({
          collectFonts: false,
          maskAllInputs: true,
          maskTextSelector: "*",
          recordBody: false,
          recordCrossOriginIframes: false,
          recordHeaders: false,
        }),
      }),
    );

    const config = buildAnalyticsInitConfig();
    expect(config.session_recording?.maskCapturedNetworkRequestFn?.({} as never)).toBeNull();
  });

  it("redacts default URL query strings before events leave the browser", async () => {
    const { buildAnalyticsInitConfig } = await import("./client");
    const config = buildAnalyticsInitConfig();
    const beforeSend = config.before_send;

    if (typeof beforeSend !== "function") {
      throw new Error("Expected a single before_send function");
    }

    const sanitized = beforeSend({
      event: "weblingo_test_event",
      properties: {
        $current_url: "https://weblingo.app/dashboard?token=secret#billing",
        $referrer: "https://example.com/?email=person@example.com",
      },
      uuid: "test-event",
    });

    expect(sanitized?.properties.$current_url).toBe("https://weblingo.app/dashboard");
    expect(sanitized?.properties.$referrer).toBe("https://example.com/");
  });

  it("identifies dashboard users and groups them by account", async () => {
    const { identifyAnalyticsUser } = await import("./client");

    identifyAnalyticsUser({
      distinctId: " user-1 ",
      accountId: " acct-1 ",
      actorAccountId: " acct-admin ",
      planType: " pro ",
      planStatus: " active ",
      workspaceAudience: " agency ",
      actingAsCustomer: true,
    });

    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      account_id: "acct-1",
      actor_account_id: "acct-admin",
      dashboard_plan_type: "pro",
      dashboard_plan_status: "active",
      dashboard_workspace_audience: "agency",
      dashboard_acting_as_customer: true,
      dashboard_user: true,
    });
    expect(posthogMock.init).toHaveBeenCalledOnce();
    expect(posthogMock.group).toHaveBeenCalledWith("account", "acct-1", {
      plan_type: "pro",
      plan_status: "active",
      workspace_audience: "agency",
    });
  });

  it("skips identity calls without a distinct id", async () => {
    const { identifyAnalyticsUser } = await import("./client");

    identifyAnalyticsUser({ distinctId: " ", accountId: "acct-1" });

    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.group).not.toHaveBeenCalled();
  });

  it("resets analytics identity during sign-out", async () => {
    const { resetAnalyticsIdentity } = await import("./client");

    resetAnalyticsIdentity();

    expect(posthogMock.reset).toHaveBeenCalledOnce();
  });
});
