import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { docSections } from "@/content/docs";
import { getWorkflowPlaybooks } from "@/content/docs/workflow-playbooks";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const workflowCount = getWorkflowPlaybooks().length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold text-foreground">{t("docs.title")}</h1>
        <p className="text-base text-muted-foreground">{t("docs.overview")}</p>
      </header>

      <div className="grid gap-10">
        {docSections.map((section) => (
          <section key={section.title} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground">
                {section.items.length === 1
                  ? t("docs.section.single")
                  : t("docs.section.multiple", undefined, {
                      count: section.items.length.toString(),
                    })}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {section.items.map((doc) => {
                const href = `/${locale}/docs/${doc.slug.join("/")}`;
                return (
                  <Link key={href} href={href} className="group">
                    <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                      <CardHeader>
                        <CardTitle className="text-xl">{doc.title}</CardTitle>
                        <CardDescription>{doc.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                          {t("docs.section.read")}
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {workflowCount > 0 ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Workflows</h2>
              <p className="text-sm text-muted-foreground">
                {workflowCount} generated playbook{workflowCount === 1 ? "" : "s"} linked to API
                capabilities.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Link href={`/${locale}/docs/workflows`} className="group">
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-xl">Workflow Playbooks</CardTitle>
                    <CardDescription>
                      Task-specific docs generated from synced backend playbooks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Open workflows
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>
        ) : null}
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
      "Guides, API references, tutorials, and translated documentation for building and running WebLingo.",
  });
}
