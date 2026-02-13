import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkflowPlaybooks } from "@/content/docs/workflow-playbooks";
import { createLocalizedMetadata, normalizeLocale } from "@internal/i18n";

export default async function WorkflowPlaybooksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const playbooks = getWorkflowPlaybooks();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflows
        </p>
        <h1 className="text-4xl font-semibold text-foreground">Workflow Playbooks</h1>
        <p className="text-base text-muted-foreground">
          Task-focused sequences generated from synced backend playbooks. Use API Reference for
          payload and response schemas.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {playbooks.map((playbook) => {
          const href = `/${locale}/docs/workflows/${playbook.slug}`;
          const summary =
            playbook.stepDetails[0]?.text ??
            playbook.notes[0] ??
            "Follow the workflow steps and validate outcomes per stage.";
          return (
            <Link key={playbook.id} href={href} className="group">
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">{playbook.shortTitle}</CardTitle>
                  <CardDescription>{summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {playbook.operationIds.length} operation
                    {playbook.operationIds.length === 1 ? "" : "s"}
                    {playbook.surfacePaths.length > 0
                      ? ` · ${playbook.surfacePaths.length} serve surface${playbook.surfacePaths.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Open workflow
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Need schema details? Go to{" "}
        <Link href={`/${locale}/docs/api-reference`} className="font-medium text-primary">
          API Reference
        </Link>
        .
      </p>
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
    titleFallback: "Workflow Playbooks",
    descriptionFallback:
      "Task-oriented API workflows for account setup, domains, crawl/translate, and previews.",
  });
}
