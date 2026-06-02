import { notFound } from "next/navigation";

import { AuthLoginForm } from "@/components/auth-login-form";
import { envServer } from "@internal/core/env-server";
import { normalizeLocale } from "@internal/i18n";

type LoginSearchParams = Promise<{ next?: string | string[] }>;

function readLoginReturnPath(searchParams: Awaited<LoginSearchParams>): string | null {
  const value = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next;
  if (
    typeof value === "string" &&
    (value === "/dashboard" || value.startsWith("/dashboard/") || value.startsWith("/dashboard?"))
  ) {
    return value;
  }
  return null;
}

export default async function LocaleLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: LoginSearchParams;
}) {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  return <AuthLoginForm redirectTo={readLoginReturnPath(await searchParams)} />;
}
