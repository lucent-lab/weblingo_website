import { cookies } from "next/headers";

import type { SiteSummary } from "./webhooks";

export const SUBJECT_ACCOUNT_COOKIE = "weblingo_dashboard_subject";

export type DashboardWorkspaceAudience = "agency" | "customer";
export type DashboardWebsiteWorkspaceKind =
  | "agency_portfolio"
  | "no_current_website"
  | "single_current_website"
  | "duplicate_current_websites";

type DashboardWorkspaceActor = {
  actorAccount?: {
    planType?: string | null;
  } | null;
};

type DashboardWorkspaceSiteLimit = DashboardWorkspaceActor & {
  account?: {
    featureFlags?: {
      maxSites?: number | null;
    } | null;
  } | null;
};

type DashboardWorkspacePolicyAuth = DashboardWorkspaceSiteLimit & {
  mutationsAllowed?: boolean;
  has?: (capability: { feature: "site_create" }) => boolean;
};

export type DashboardWebsiteWorkspaceState = {
  audience: DashboardWorkspaceAudience;
  kind: DashboardWebsiteWorkspaceKind;
  sites: SiteSummary[];
  activeSites: SiteSummary[];
  currentSite: SiteSummary | null;
  visibleSites: SiteSummary[];
  billingBlocked: boolean;
  maxSites: number | null;
  hasAvailableSlot: boolean;
  atSiteLimit: boolean;
  canCreateSite: boolean;
};

export function resolveDashboardWorkspaceAudience(
  auth: DashboardWorkspaceActor,
): DashboardWorkspaceAudience {
  return auth.actorAccount?.planType === "agency" ? "agency" : "customer";
}

export function isCustomerDashboardWorkspace(auth: DashboardWorkspaceActor): boolean {
  return resolveDashboardWorkspaceAudience(auth) === "customer";
}

export function getDashboardSitesLabel(audience: DashboardWorkspaceAudience): string {
  return audience === "agency" ? "Sites" : "Website";
}

export function resolveDashboardMaxSitesLimit(auth: DashboardWorkspaceSiteLimit): number | null {
  if (isCustomerDashboardWorkspace(auth)) {
    return 1;
  }
  return auth.account?.featureFlags?.maxSites ?? null;
}

export function resolveDashboardWebsiteWorkspaceState(
  auth: DashboardWorkspacePolicyAuth,
  sites: SiteSummary[],
): DashboardWebsiteWorkspaceState {
  const audience = resolveDashboardWorkspaceAudience(auth);
  const activeSites = sites.filter((site) => site.status === "active");
  const currentSite = audience === "customer" && activeSites.length === 1 ? activeSites[0]! : null;
  const kind: DashboardWebsiteWorkspaceKind =
    audience === "agency"
      ? "agency_portfolio"
      : activeSites.length === 0
        ? "no_current_website"
        : activeSites.length === 1
          ? "single_current_website"
          : "duplicate_current_websites";
  const maxSites = resolveDashboardMaxSitesLimit(auth);
  const billingBlocked = auth.mutationsAllowed === false;
  const hasAvailableSlot = maxSites === null || activeSites.length < maxSites;
  const atSiteLimit = maxSites !== null && activeSites.length >= maxSites;
  const canCreateSite =
    auth.has?.({ feature: "site_create" }) === true && !billingBlocked && hasAvailableSlot;
  return {
    audience,
    kind,
    sites,
    activeSites,
    currentSite,
    visibleSites: audience === "agency" ? sites : currentSite ? [currentSite] : [],
    billingBlocked,
    maxSites,
    hasAvailableSlot,
    atSiteLimit,
    canCreateSite,
  };
}

export async function readSubjectAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SUBJECT_ACCOUNT_COOKIE)?.value.trim();
  if (!value || value === "undefined" || value === "null") {
    return null;
  }
  return value;
}

export async function clearSubjectAccountId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SUBJECT_ACCOUNT_COOKIE);
}
