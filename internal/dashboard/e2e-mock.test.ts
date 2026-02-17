import { afterEach, describe, expect, test } from "vitest";

import { isDashboardE2eMockEnabled } from "./e2e-mock";

const ORIGINAL_DASHBOARD_E2E_MOCK = process.env.DASHBOARD_E2E_MOCK;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

function setEnv(name: string, value: string | undefined) {
  (process.env as Record<string, string | undefined>)[name] = value;
}

afterEach(() => {
  setEnv("DASHBOARD_E2E_MOCK", ORIGINAL_DASHBOARD_E2E_MOCK);
  setEnv("NODE_ENV", ORIGINAL_NODE_ENV);
  setEnv("VERCEL_ENV", ORIGINAL_VERCEL_ENV);
});

describe("isDashboardE2eMockEnabled", () => {
  test("returns false when mock flag is disabled", () => {
    setEnv("DASHBOARD_E2E_MOCK", "0");
    setEnv("NODE_ENV", "development");
    setEnv("VERCEL_ENV", "preview");

    expect(isDashboardE2eMockEnabled()).toBe(false);
  });

  test("returns true when mock flag is enabled outside production", () => {
    setEnv("DASHBOARD_E2E_MOCK", "1");
    setEnv("NODE_ENV", "test");
    setEnv("VERCEL_ENV", "preview");

    expect(isDashboardE2eMockEnabled()).toBe(true);
  });

  test("returns false when NODE_ENV is production", () => {
    setEnv("DASHBOARD_E2E_MOCK", "1");
    setEnv("NODE_ENV", "production");
    setEnv("VERCEL_ENV", "preview");

    expect(isDashboardE2eMockEnabled()).toBe(false);
  });

  test("returns false when VERCEL_ENV is production", () => {
    setEnv("DASHBOARD_E2E_MOCK", "1");
    setEnv("NODE_ENV", "development");
    setEnv("VERCEL_ENV", "production");

    expect(isDashboardE2eMockEnabled()).toBe(false);
  });
});
