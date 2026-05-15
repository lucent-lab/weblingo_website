import { cookies } from "next/headers";

export const SUBJECT_ACCOUNT_COOKIE = "weblingo_dashboard_subject";

export type DashboardWorkspaceAudience = "agency" | "customer";

type DashboardWorkspaceActor = {
  actorAccount?: {
    planType?: string | null;
  } | null;
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
