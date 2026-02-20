import { notFound } from "next/navigation";

import { LaunchBanner } from "@components/launch-banner";
import { PreviewStatusCenter } from "@components/preview-status-center";
import { SiteFooter } from "@components/site-footer";
import { SiteHeader } from "@components/site-header";
import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function MarketingLayout({
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

  const { messages, t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
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
      <div className="flex min-h-screen flex-col">
        <SiteHeader locale={locale} t={t} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale={locale} t={t} />
      </div>
      <LaunchBanner copy={bannerCopy} />
      <PreviewStatusCenter messages={messages} />
    </>
  );
}
