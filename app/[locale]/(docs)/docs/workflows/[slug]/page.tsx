import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getWorkflowPlaybookBySlug, getWorkflowPlaybooks } from "@/content/docs/workflow-playbooks";
import { createLocalizedMetadata, i18nConfig, normalizeLocale } from "@internal/i18n";

type PageParams = {
  locale: string;
  slug: string;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const playbooks = getWorkflowPlaybooks();
  return i18nConfig.locales.flatMap((locale) =>
    playbooks.map((playbook) => ({
      locale,
      slug: playbook.slug,
    })),
  );
}

export default async function WorkflowPlaybookDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const playbook = getWorkflowPlaybookBySlug(slug);
  if (!playbook) {
    notFound();
  }

  return (
    <article className="mx-auto w-full max-w-3xl pb-16">
      <header className="space-y-4 pb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow
        </p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-foreground">{playbook.shortTitle}</h1>
          <p className="text-lg text-muted-foreground">
            Follow the sequence below, then use API Reference for payload schema and response
            details.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Steps</h2>
        <ol className="ml-6 list-decimal space-y-5 text-muted-foreground">
          {playbook.stepDetails.map((step, index) => (
            <li key={`${playbook.id}:step:${index}`} className="space-y-2">
              <p className="text-foreground">{step.text}</p>
              {step.operationIds.length > 0 ? (
                <p className="text-sm">
                  Operation IDs:{" "}
                  {step.operationIds.map((operationId, operationIndex) => (
                    <span key={`${playbook.id}:step:${index}:op:${operationId}`}>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{operationId}</code>
                      {operationIndex < step.operationIds.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              ) : null}
              {step.surfacePaths.length > 0 ? (
                <p className="text-sm">
                  Surface paths:{" "}
                  {step.surfacePaths.map((surfacePath, surfaceIndex) => (
                    <span key={`${playbook.id}:step:${index}:surface:${surfacePath}`}>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{surfacePath}</code>
                      {surfaceIndex < step.surfacePaths.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {playbook.notes.length > 0 ? (
        <section className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Notes</h2>
          <div className="space-y-3 text-muted-foreground">
            {playbook.notes.map((note, index) => (
              <p key={`${playbook.id}:note:${index}`}>{note}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Related Docs</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/${locale}/docs/workflows`}>
              <ArrowLeft className="h-4 w-4" />
              All workflows
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/${locale}/docs/api-reference`}>
              API reference
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  const playbook = getWorkflowPlaybookBySlug(slug);
  if (!playbook) {
    return {};
  }

  return createLocalizedMetadata(Promise.resolve({ locale }), {
    titleFallback: `${playbook.shortTitle} | Workflow`,
    descriptionFallback: `Step-by-step workflow for ${playbook.shortTitle}.`,
  });
}
