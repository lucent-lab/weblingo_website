import { redirect } from "next/navigation";

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
