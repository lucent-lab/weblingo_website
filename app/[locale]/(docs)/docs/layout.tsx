import { notFound } from "next/navigation";

import { DocsShell, type DocsNavIconKey, type DocsNavSection } from "./_components/docs-shell";

import { docSections } from "@/content/docs";
import { getWorkflowPlaybooks } from "@/content/docs/workflow-playbooks";
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
      iconKey: resolveDocIconKey(item.slug),
    })),
  }));
  if (getWorkflowPlaybooks().length > 0) {
    navSections.push({
      title: "Workflows",
      items: [
        {
          href: `/${locale}/docs/workflows`,
          title: "Workflow Playbooks",
          iconKey: "workflows",
        },
      ],
    });
  }
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

function resolveDocIconKey(slug: string[]): DocsNavIconKey {
  const key = slug.join("/");
  switch (key) {
    case "getting-started":
      return "getting-started";
    case "site-setup":
      return "site-setup";
    case "translation-pipeline":
      return "pipeline";
    case "api-reference":
      return "api-reference";
    default:
      return "default";
  }
}
