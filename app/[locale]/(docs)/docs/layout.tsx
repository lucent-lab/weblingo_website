import { notFound } from "next/navigation";

import { DocsShell, type DocsNavSection } from "./_components/docs-shell";

import { docSections } from "@/content/docs";
import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function DocsLayout({
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
  const navSections: DocsNavSection[] = docSections.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      href: `/${locale}/docs/${item.slug.join("/")}`,
      title: item.title,
    })),
  }));
  const copy = {
    title: t("docs.shell.title"),
    subtitle: t("docs.shell.subtitle"),
    supportTitle: t("docs.shell.supportTitle"),
    supportDescription: t("docs.shell.supportDescription"),
    supportCta: t("docs.shell.supportCta"),
    homeLabel: t("nav.home"),
  };

  return (
    <DocsShell
      locale={locale}
      navSections={navSections}
      copy={copy}
      headerLinks={[
        { href: `/${locale}/docs`, label: t("nav.docs") },
        { href: `/${locale}/blog`, label: t("nav.blog") },
      ]}
    >
      {children}
    </DocsShell>
  );
}
