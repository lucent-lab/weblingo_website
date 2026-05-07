import { redirect } from "next/navigation";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

type SiteAdminRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SiteAdminRedirectPage({ params }: SiteAdminRedirectPageProps) {
  const { id } = await params;
  redirect(`/dashboard/sites/${id}/settings`);
}
