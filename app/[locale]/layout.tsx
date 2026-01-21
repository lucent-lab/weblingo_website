import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "@internal/core";
import { i18nConfig, normalizeLocale } from "@internal/i18n";

export const dynamicParams = false;

export async function generateStaticParams() {
  return i18nConfig.locales.map((locale) => ({ locale }));
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

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return {
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: Object.fromEntries(i18nConfig.locales.map((code) => [code, `${baseUrl}/${code}`])),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  if (locale !== rawLocale) {
    notFound();
  }

  return (
    <div className="min-h-screen" data-locale={locale}>
      {children}
    </div>
  );
}
