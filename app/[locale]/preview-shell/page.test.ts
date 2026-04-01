import { beforeAll, describe, expect, it } from "vitest";

const REQUIRED_ENV: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://example.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable",
  NEXT_PUBLIC_WEBHOOKS_API_BASE: "https://api.example.com/api",
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: "15000",
  PUBLIC_PORTAL_MODE: "enabled",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  SUPABASE_SECRET_KEY: "sb_secret",
  SUPABASE_AUTH_TIMEOUT_MS: "15000",
  TRY_NOW_TOKEN: "preview_token",
  PREVIEW_BASE_URL: "https://preview.weblingo.app",
  WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS: "60000",
  WEBSITE_WAITLIST_MAX_PER_WINDOW: "20",
  WEBSITE_WAITLIST_MAX_BODY_BYTES: "4096",
  WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS: "60000",
  WEBSITE_CONTACT_MAX_PER_WINDOW: "10",
  WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS: "60000",
  WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW: "20",
  WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW: "10",
  WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW: "60",
  WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW: "20",
  WEBSITE_PREVIEW_MAX_BODY_BYTES: "200",
  WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS: "15000",
  WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS: "15000",
  WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS: "15000",
  UPSTASH_REDIS__KV_REST_API_URL: "https://example.upstash.io",
  UPSTASH_REDIS__KV_REST_API_TOKEN: "upstash_token",
};

beforeAll(() => {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    process.env[key] = value;
  }
});

describe("isAllowedPreviewUrlForBase", () => {
  it("accepts the serve-worker preview host and rejects the api host", async () => {
    const { isAllowedPreviewUrlForBase } = await import("./page");

    expect(
      isAllowedPreviewUrlForBase(
        "https://weblingo.app/_preview/11111111-1111-1111-1111-111111111111",
        "https://weblingo.app",
      ),
    ).toBe(true);
    expect(
      isAllowedPreviewUrlForBase(
        "https://api.weblingo.app/_preview/11111111-1111-1111-1111-111111111111",
        "https://weblingo.app",
      ),
    ).toBe(false);
    expect(isAllowedPreviewUrlForBase("https://weblingo.app/try", "https://weblingo.app")).toBe(
      false,
    );
  });
});
