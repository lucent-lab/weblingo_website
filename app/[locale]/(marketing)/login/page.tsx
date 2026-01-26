import { notFound } from "next/navigation";

import { AuthLoginForm } from "@/components/auth-login-form";
import { env } from "@internal/core";
import { normalizeLocale } from "@internal/i18n";

export default async function LocaleLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  if (env.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  return <AuthLoginForm />;
}
