import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { envServer } from "@internal/core/env-server";
import { resolvePreferredLocale } from "@internal/i18n";

type LoginRedirectSearchParams = Promise<{ next?: string | string[] }>;

function readLoginReturnPath(searchParams: Awaited<LoginRedirectSearchParams>): string | null {
  const value = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  if (
    typeof value === "string" &&
    (value === "/dashboard" || value.startsWith("/dashboard/") || value.startsWith("/dashboard?"))
  ) {
    return value;
  }
  return null;
}

export default async function LegacyLoginRedirect({
  searchParams,
}: {
  searchParams: LoginRedirectSearchParams;
}) {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const returnPath = readLoginReturnPath(await searchParams);
  redirect(
    returnPath ? `/${locale}/login?next=${encodeURIComponent(returnPath)}` : `/${locale}/login`,
  );
}
