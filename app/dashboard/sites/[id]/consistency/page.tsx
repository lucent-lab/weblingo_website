import { notFound, redirect } from "next/navigation";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import {
  getSingleDashboardSearchParam,
  type DashboardRouteSearchParams,
} from "../focused-route-utils";

type SiteConsistencyPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DashboardRouteSearchParams>;
};

export default async function SiteConsistencyPage({
  params,
  searchParams,
}: SiteConsistencyPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  if (!isDashboardAuthScopedToSite(auth, id)) {
    notFound();
  }
  const query = new URLSearchParams();

  const dashboardLocale = getSingleDashboardSearchParam(resolvedSearchParams?.locale);
  if (dashboardLocale) {
    query.set("locale", dashboardLocale);
  }

  const sourceLang = getSingleDashboardSearchParam(resolvedSearchParams?.sourceLang);
  if (sourceLang) {
    query.set("sourceLang", sourceLang);
  }

  const targetLang = getSingleDashboardSearchParam(resolvedSearchParams?.targetLang);
  if (targetLang) {
    query.set("targetLang", targetLang);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  redirect(`/dashboard/sites/${id}/overrides${suffix}`);
}
