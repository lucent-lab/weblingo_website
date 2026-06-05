import { notFound, redirect } from "next/navigation";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";

type SiteConsistencyPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sourceLang?: string; targetLang?: string }>;
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

  if (resolvedSearchParams?.sourceLang) {
    query.set("sourceLang", resolvedSearchParams.sourceLang);
  }

  if (resolvedSearchParams?.targetLang) {
    query.set("targetLang", resolvedSearchParams.targetLang);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  redirect(`/dashboard/sites/${id}/overrides${suffix}`);
}
