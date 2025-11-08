import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LaunchBanner } from "@components/launch-banner";
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

  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  const bannerCopy = {
    badge: t("banner.badge"),
    title: t("banner.title"),
    subtitle: t("banner.subtitle"),
    emailPlaceholder: t("banner.emailPlaceholder"),
    sitePlaceholder: t("banner.sitePlaceholder"),
    buttonIdle: t("banner.button.idle"),
    buttonLoading: t("banner.button.loading"),
    buttonSuccess: t("banner.button.success"),
    successMessage: t("banner.message.success"),
    defaultMessage: t("banner.message.default"),
    dismissLabel: t("banner.dismiss"),
  };

  return (
    <>
      <div className="flex min-h-screen flex-col" data-locale={locale}>
        <SiteHeader locale={locale} t={t} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale={locale} t={t} />
      </div>
      <LaunchBanner copy={bannerCopy} />
    </>
  );
}
