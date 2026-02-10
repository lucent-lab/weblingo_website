import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const verifyStripeSignature = vi.fn();
vi.mock("@internal/billing", () => ({ verifyStripeSignature }));

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
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

  process.env.KV_REST_API_URL = "https://example.com";
  process.env.KV_REST_API_TOKEN = "dummy";
}

function makeRequest(body: string): NextRequest {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "sig_test",
    },
    body,
  }) as unknown as NextRequest;
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

beforeEach(() => {
  verifyStripeSignature.mockReset();
});

describe("POST /api/stripe/webhook", () => {
  it("redacts signature verification errors in production responses", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      verifyStripeSignature.mockImplementationOnce(() => {
        throw new Error("secret sk_test_leak");
      });

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(makeRequest("{}"));

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload).toMatchObject({ error: "Invalid Stripe signature" });
      expect(payload.request_id).toBeTruthy();
      expect(JSON.stringify(payload)).not.toContain("sk_test_leak");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });
});
