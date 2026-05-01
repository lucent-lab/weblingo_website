import { notFound } from "next/navigation";

import { SiteHeaderBar } from "@/components/site-header-bar";
import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function BlogLayout({
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

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <SiteHeaderBar
        locale={locale}
        links={[
          { href: `/${locale}/pricing`, label: t("nav.pricing") },
          { href: `/${locale}/docs`, label: t("nav.docs") },
          { href: `/${locale}/blog`, label: t("nav.blog") },
        ]}
        menuLabel={t("nav.menu")}
        primaryAction={{ href: `/${locale}#try`, label: t("nav.try") }}
        innerClassName="max-w-6xl lg:px-6"
      />
      <main className="flex-1 px-4 py-8 lg:px-6">{children}</main>
    </div>
  );
}
