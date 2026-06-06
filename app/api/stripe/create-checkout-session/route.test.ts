import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const createCheckoutSession = vi.fn();
vi.mock("@internal/billing", () => ({ createCheckoutSession }));

const analyticsMocks = vi.hoisted(() => ({
  captureServerAnalyticsEvent: vi.fn(),
  captureServerException: vi.fn(),
  hashAnalyticsIdentifier: vi.fn((namespace: string, value: string | null | undefined) =>
    value ? `${namespace}:hashed` : null,
  ),
}));
vi.mock("@internal/analytics/server", () => analyticsMocks);

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "http://localhost:3000/_analytics/posthog";
  process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "enabled";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "disabled";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "0";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.com";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "dummy";
}

function makeRequest(payload: unknown): NextRequest {
  return new Request("http://localhost/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

beforeEach(() => {
  createCheckoutSession.mockReset();
  analyticsMocks.captureServerAnalyticsEvent.mockReset();
  analyticsMocks.captureServerException.mockReset();
  analyticsMocks.hashAnalyticsIdentifier.mockClear();
});

describe("POST /api/stripe/create-checkout-session", () => {
  it("redacts internal errors in production responses", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      createCheckoutSession.mockRejectedValueOnce(new Error("secret sk_test_leak"));

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(
        makeRequest({ planId: "starter", cadence: "monthly", locale: "en", email: "a@b.com" }),
      );

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: "Unable to start checkout right now" });
      expect(payload.request_id).toBeTruthy();
      expect(JSON.stringify(payload)).not.toContain("sk_test_leak");
      expect(analyticsMocks.captureServerAnalyticsEvent).toHaveBeenCalledWith(
        "checkout_session_create_failed",
        expect.objectContaining({
          plan_id: "starter",
          cadence: "monthly",
          locale: "en",
          failure_kind: "server",
          failure_status: 500,
        }),
        expect.any(Object),
      );
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ source: "stripe_create_checkout_session" }),
        expect.any(Object),
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });

  it("treats upstream Invalid Stripe errors as internal failures", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      createCheckoutSession.mockRejectedValueOnce(new Error("Invalid API key provided"));

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(
        makeRequest({ planId: "starter", cadence: "monthly", locale: "en" }),
      );

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: "Unable to start checkout right now" });
      expect(JSON.stringify(payload)).not.toContain("Invalid API key provided");
      expect(analyticsMocks.captureServerAnalyticsEvent).toHaveBeenCalledWith(
        "checkout_session_create_failed",
        expect.objectContaining({
          failure_kind: "server",
          failure_status: 500,
        }),
        expect.any(Object),
      );
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ source: "stripe_create_checkout_session" }),
        expect.any(Object),
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });
});
