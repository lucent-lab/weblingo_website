import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { normalizeLocale } from "@internal/i18n";
import { ClassicHomePage, getClassicHomeMetadata } from "@modules/home/classic-home";

export default async function ClassicLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  return <ClassicHomePage locale={locale} basePath={`/${locale}/landing/classic`} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  return getClassicHomeMetadata({ locale, noIndex: true });
}
