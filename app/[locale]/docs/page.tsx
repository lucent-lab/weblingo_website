import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const languages = t("docs.languages.list")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="bg-background pb-24 pt-20 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-semibold text-foreground">{t("docs.title")}</h1>
          <p className="text-base text-muted-foreground">{t("docs.overview")}</p>
        </header>
        <ol className="list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          <li>{t("docs.step.one")}</li>
          <li>{t("docs.step.two")}</li>
          <li>{t("docs.step.three")}</li>
          <li>{t("docs.step.four")}</li>
        </ol>
        <section className="rounded-2xl border border-border bg-muted p-6">
          <h2 className="text-lg font-semibold text-primary">{t("docs.cname.heading")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("docs.cname.description")}</p>
        </section>
        <section id="languages" className="rounded-2xl border border-border bg-muted p-6 text-left">
          <h2 className="text-lg font-semibold text-primary">{t("docs.languages.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("docs.languages.description")}</p>
          <p className="mt-4 text-sm font-medium text-foreground">{t("docs.languages.label")}</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 md:grid-cols-3">
            {languages.map((language) => (
              <li key={language} className="rounded-lg bg-background px-3 py-2 shadow-sm">
                {language}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">{t("docs.languages.contact")}</p>
        </section>
      </div>
    </div>
  );
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
  return createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: "docs.title",
    descriptionKey: "docs.overview",
    titleFallback: "Docs",
    descriptionFallback:
      "Deploy translated versions of your site with CNAME routing, CDN hosting, and automatic content refresh.",
  });
}
