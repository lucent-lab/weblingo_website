import type { DashboardAuth } from "./auth";

type DemoScopeAuth = {
  accessMode?: DashboardAuth["accessMode"];
  demoSession?: Pick<NonNullable<DashboardAuth["demoSession"]>, "siteId"> | null;
};

export function isDashboardAuthScopedToSite(auth: DemoScopeAuth, siteId: string): boolean {
  return auth.accessMode !== "demo" || auth.demoSession?.siteId === siteId;
}

export function getDashboardDemoSiteId(auth: DemoScopeAuth): string | null {
  return auth.accessMode === "demo" ? (auth.demoSession?.siteId ?? null) : null;
}
