export function isDashboardE2eMockEnabled(): boolean {
  if (process.env.DASHBOARD_E2E_MOCK !== "1") {
    return false;
  }

  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}
