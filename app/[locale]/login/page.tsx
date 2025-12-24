import { notFound } from "next/navigation";

import { AuthLoginForm } from "@/components/auth-login-form";
import { normalizeLocale } from "@internal/i18n";

export default async function LocaleLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  return <AuthLoginForm />;
}
