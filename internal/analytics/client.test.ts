// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  reset: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

function setRequiredClientEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "https://weblingo.app";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "https://metrics.weblingo.app";
  process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "enabled";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "disabled";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "0";
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
  posthogMock.startSessionRecording.mockReset();
  posthogMock.stopSessionRecording.mockReset();
});

describe("client analytics helpers", () => {
  it("initializes PostHog with maximum privacy session replay defaults", async () => {
    const { buildAnalyticsInitConfig, initializeAnalytics } = await import("./client");

    initializeAnalytics();

    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "https://metrics.weblingo.app",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-01-30",
        autocapture: false,
        capture_heatmaps: false,
        capture_pageleave: false,
        capture_pageview: false,
        capture_performance: false,
        cross_subdomain_cookie: false,
        disable_session_recording: true,
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
          sampleRate: 0,
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
        $session_entry_url: "https://weblingo.app/error?message=secret&trace=NotARealPassword",
        $prev_pageview_url: "https://weblingo.app/pricing?session_id=cs_secret_123",
        $referrer: "https://example.com/?email=person@example.com",
      },
      uuid: "test-event",
    });

    expect(sanitized?.properties.$current_url).toBe("https://weblingo.app/dashboard");
    expect(sanitized?.properties.$session_entry_url).toBe("https://weblingo.app/error");
    expect(sanitized?.properties.$prev_pageview_url).toBe("https://weblingo.app/pricing");
    expect(sanitized?.properties.$referrer).toBe("https://example.com/");
  });

  it("rewrites SDK URL properties to safe route templates for navigation events", async () => {
    const { buildAnalyticsInitConfig } = await import("./client");
    const config = buildAnalyticsInitConfig();
    const beforeSend = config.before_send;

    if (typeof beforeSend !== "function") {
      throw new Error("Expected a single before_send function");
    }

    const sanitized = beforeSend({
      event: "$pageview",
      properties: {
        $current_url: "https://weblingo.app/dashboard/sites/site_1234567890/settings?token=secret",
        $initial_current_url: "https://weblingo.app/dashboard/sites/site_1234567890/settings",
        $session_entry_url: "https://weblingo.app/dashboard/sites/site_1234567890?token=secret",
        $pathname: "/dashboard/sites/site_1234567890/settings",
        $session_entry_pathname: "/dashboard/sites/site_1234567890",
        $prev_pageview_pathname: "/dashboard/sites/site_1234567890/pages",
        page_path: "/dashboard/sites/[id]/settings",
        route_template: "/dashboard/sites/[id]/settings",
      },
      uuid: "test-event",
    });

    expect(sanitized?.properties.$current_url).toBe(
      "https://weblingo.app/dashboard/sites/[id]/settings",
    );
    expect(sanitized?.properties.$initial_current_url).toBe(
      "https://weblingo.app/dashboard/sites/[id]/settings",
    );
    expect(sanitized?.properties.$session_entry_url).toBe(
      "https://weblingo.app/dashboard/sites/[id]/settings",
    );
    expect(sanitized?.properties.$pathname).toBe("/dashboard/sites/[id]/settings");
    expect(sanitized?.properties.$session_entry_pathname).toBe("/dashboard/sites/[id]/settings");
    expect(sanitized?.properties.$prev_pageview_pathname).toBe("/dashboard/sites/[id]/settings");
  });

  it("adds safe canonical pageview URL properties when PostHog omits the raw URL", async () => {
    const { buildAnalyticsInitConfig } = await import("./client");
    const config = buildAnalyticsInitConfig();
    const beforeSend = config.before_send;

    if (typeof beforeSend !== "function") {
      throw new Error("Expected a single before_send function");
    }

    const sanitized = beforeSend({
      event: "$pageview",
      properties: {
        $host: "www.weblingo.app",
        page_path: "/[locale]/pricing",
        route_template: "/[locale]/pricing",
      },
      uuid: "test-event",
    });

    expect(sanitized?.properties.$current_url).toBe("https://www.weblingo.app/[locale]/pricing");
    expect(sanitized?.properties.$pathname).toBe("/[locale]/pricing");
  });

  it("keeps browser routing separate from the upstream PostHog ingestion host", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "https://metrics.weblingo.app";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
    const { buildAnalyticsInitConfig } = await import("./client");

    expect(buildAnalyticsInitConfig()).toEqual(
      expect.objectContaining({
        api_host: "https://metrics.weblingo.app",
        ui_host: "https://eu.posthog.com",
      }),
    );
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
      app_surface: "dashboard",
      deployment_channel: "test",
      dashboard_plan_type: "pro",
      dashboard_plan_status: "active",
      dashboard_workspace_audience: "agency",
      dashboard_acting_as_customer: true,
      dashboard_user: true,
      environment: "test",
      repo: "weblingo_website",
    });
    expect(posthogMock.init).toHaveBeenCalledOnce();
    expect(posthogMock.group).toHaveBeenCalledWith("account", "acct-1", {
      app_surface: "dashboard",
      deployment_channel: "test",
      environment: "test",
      plan_type: "pro",
      plan_status: "active",
      repo: "weblingo_website",
      workspace_audience: "agency",
    });
  });

  it("groups site-scoped dashboard routes by site", async () => {
    const { groupAnalyticsSite } = await import("./client");

    groupAnalyticsSite({
      siteId: " site-1 ",
      accountId: " acct-1 ",
      actorAccountId: " acct-admin ",
      actorRole: " agency_actor ",
      planType: " starter ",
      planStatus: " active ",
      workspaceAudience: " customer ",
      actingAsCustomer: false,
    });

    expect(posthogMock.group).toHaveBeenCalledWith("site", "site-1", {
      account_id: "acct-1",
      actor_account_id: "acct-admin",
      actor_role: "agency_actor",
      app_surface: "dashboard",
      dashboard_acting_as_customer: false,
      deployment_channel: "test",
      environment: "test",
      plan_status: "active",
      plan_type: "starter",
      repo: "weblingo_website",
      workspace_audience: "customer",
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

  it("can send pageview events immediately", async () => {
    const { captureAnalyticsEvent } = await import("./client");

    captureAnalyticsEvent(
      "$pageview",
      { route_template: "/dashboard" },
      {
        sendInstantly: true,
      },
    );

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "$pageview",
      {
        app_surface: "marketing",
        deployment_channel: "test",
        environment: "test",
        repo: "weblingo_website",
        route_template: "/dashboard",
      },
      { send_instantly: true },
    );
  });

  it("does not initialize or capture when analytics capture is disabled", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "disabled";
    const {
      captureAnalyticsEvent,
      groupAnalyticsSite,
      identifyAnalyticsUser,
      initializeAnalytics,
      resetAnalyticsIdentity,
      syncAnalyticsSessionReplayForPath,
    } = await import("./client");

    initializeAnalytics();
    captureAnalyticsEvent("marketing_cta_clicked", { cta_id: "hero" });
    identifyAnalyticsUser({ distinctId: "user-1", accountId: "acct-1" });
    groupAnalyticsSite({ siteId: "site-1", accountId: "acct-1" });
    resetAnalyticsIdentity();
    syncAnalyticsSessionReplayForPath("/pricing");

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.group).not.toHaveBeenCalled();
    expect(posthogMock.reset).not.toHaveBeenCalled();
    expect(posthogMock.startSessionRecording).not.toHaveBeenCalled();
  });

  it("starts replay only on sampled allowlisted routes and stops it on blocked routes", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "sampled";
    process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "1";
    const { syncAnalyticsSessionReplayForPath } = await import("./client");

    syncAnalyticsSessionReplayForPath("/en/pricing");
    syncAnalyticsSessionReplayForPath("/dashboard");

    expect(posthogMock.init).toHaveBeenCalledOnce();
    expect(posthogMock.startSessionRecording).toHaveBeenCalledWith({ sampling: true });
    expect(posthogMock.stopSessionRecording).toHaveBeenCalledOnce();
  });

  it("does not initialize replay on checkout URLs carrying session query strings", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "sampled";
    process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "1";
    const { syncAnalyticsSessionReplayForPath } = await import("./client");

    syncAnalyticsSessionReplayForPath("/ja/checkout/success?session_id=cs_secret_123");

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.startSessionRecording).not.toHaveBeenCalled();
    expect(posthogMock.stopSessionRecording).not.toHaveBeenCalled();
  });
});
