import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const previewTestEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_playwright",
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "phc_playwright",
  NEXT_PUBLIC_POSTHOG_HOST:
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://posthog.playwright.invalid",
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.playwright.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_playwright",
  NEXT_PUBLIC_WEBHOOKS_API_BASE:
    process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE ?? "https://api.playwright.invalid",
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS ?? "15000",
  PUBLIC_PORTAL_MODE: process.env.PUBLIC_PORTAL_MODE ?? "disabled",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_playwright",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_playwright",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? "sb_secret_playwright",
  SUPABASE_AUTH_TIMEOUT_MS: process.env.SUPABASE_AUTH_TIMEOUT_MS ?? "15000",
  TRY_NOW_TOKEN: process.env.TRY_NOW_TOKEN ?? "playwright-preview-token",
  WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS:
    process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS ?? "60000",
  WEBSITE_WAITLIST_MAX_PER_WINDOW: process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW ?? "20",
  WEBSITE_WAITLIST_MAX_BODY_BYTES: process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES ?? "4096",
  WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS: process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS ?? "60000",
  WEBSITE_CONTACT_MAX_PER_WINDOW: process.env.WEBSITE_CONTACT_MAX_PER_WINDOW ?? "10",
  WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS: process.env.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS ?? "60000",
  WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW: process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW ?? "20",
  WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW:
    process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW ?? "5",
  WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW: process.env.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW ?? "120",
  WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW: process.env.WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW ?? "30",
  WEBSITE_PREVIEW_MAX_BODY_BYTES: process.env.WEBSITE_PREVIEW_MAX_BODY_BYTES ?? "4096",
  WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS:
    process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS ?? "10000",
  WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS:
    process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS ?? "5000",
  WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS:
    process.env.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS ?? "5000",
  UPSTASH_REDIS__KV_REST_API_URL:
    process.env.UPSTASH_REDIS__KV_REST_API_URL ?? "https://redis.playwright.invalid",
  UPSTASH_REDIS__KV_REST_API_TOKEN:
    process.env.UPSTASH_REDIS__KV_REST_API_TOKEN ?? "redis_token_playwright",
};

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: `pnpm run dev --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      ...previewTestEnv,
      DASHBOARD_E2E_MOCK: process.env.DASHBOARD_E2E_MOCK ?? "0",
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
});
