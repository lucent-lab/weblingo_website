import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PRODUCTION_PORT ?? "3001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: /(showcase-fixtures|customer-seo-fixtures)\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: `pnpm exec next start --hostname 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      DASHBOARD_E2E_MOCK: process.env.DASHBOARD_E2E_MOCK ?? "0",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
});
