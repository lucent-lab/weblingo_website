import type { Metadata } from "next";

import { DemoDashboardEntry } from "./demo-dashboard-entry";

export const metadata: Metadata = {
  title: "Demo Dashboard",
  robots: { index: false, follow: false },
};

export default async function DemoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  return <DemoDashboardEntry accessToken={token} />;
}
