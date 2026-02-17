import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: "pnpm run dev --hostname 127.0.0.1 --port 3000",
    env: {
      ...process.env,
      DASHBOARD_E2E_MOCK: process.env.DASHBOARD_E2E_MOCK ?? "0",
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
});
