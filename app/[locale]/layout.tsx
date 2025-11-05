import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@components/site-footer";
import { SiteHeader } from "@components/site-header";
import { env } from "@internal/core";
import { createTranslator, getMessages, i18nConfig, normalizeLocale } from "@internal/i18n";

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
  return {
    alternates: {
      canonical: `${env.NEXT_PUBLIC_APP_URL}/${locale}`,
      languages: Object.fromEntries(
        i18nConfig.locales.map((code) => [code, `${env.NEXT_PUBLIC_APP_URL}/${code}`]),
      ),
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

  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="flex min-h-screen flex-col" data-locale={locale}>
      <SiteHeader locale={locale} t={t} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} t={t} />
    </div>
  );
}
