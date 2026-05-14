import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const previewTestEnv = {
  NEXT_PUBLIC_WEBHOOKS_API_BASE:
    process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE ?? "https://api.playwright.invalid",
  TRY_NOW_TOKEN: process.env.TRY_NOW_TOKEN ?? "playwright-preview-token",
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
