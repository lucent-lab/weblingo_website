import { notFound } from "next/navigation";

import { PreviewStatusCenter } from "@components/preview-status-center";
import { SiteFooter } from "@components/site-footer";
import { SiteHeader } from "@components/site-header";
import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";
import { PREVIEW_STATUS_CENTER_MESSAGE_KEYS } from "@internal/previews/status-center-i18n";

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
  const statusCenterMessages = Object.fromEntries(
    PREVIEW_STATUS_CENTER_MESSAGE_KEYS.map((key) => [key, messages[key] ?? key]),
  );

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <SiteHeader locale={locale} t={t} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale={locale} t={t} />
      </div>
      <PreviewStatusCenter messages={statusCenterMessages} />
    </>
  );
}
