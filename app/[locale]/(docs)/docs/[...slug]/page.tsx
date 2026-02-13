import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { docSections, docs, getDocBySlug } from "@/content/docs";
import { cn } from "@/lib/utils";
import { env } from "@internal/core";
import { i18nConfig, normalizeLocale } from "@internal/i18n";

export const dynamicParams = false;

export async function generateStaticParams() {
  return i18nConfig.locales.flatMap((locale) =>
    docs.map((doc) => ({
      locale,
      slug: doc.slug,
    })),
  );
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const doc = getDocBySlug(slug);
  if (!doc) {
    notFound();
  }

  const orderedDocs = docSections.flatMap((section) => section.items);
  const currentIndex = orderedDocs.findIndex((entry) => entry.slug.join("/") === slug.join("/"));
  const prev = currentIndex > 0 ? orderedDocs[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? (orderedDocs[currentIndex + 1] ?? null) : null;
  const DocComponent = doc.component;
  const isApiReference = doc.slug.join("/") === "api-reference";

  return (
    <article className={cn("mx-auto w-full pb-16", isApiReference ? "max-w-none" : "max-w-3xl")}>
      <header className="space-y-4 pb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {doc.section}
        </p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-foreground">{doc.title}</h1>
          {doc.description ? (
            <p className="text-lg text-muted-foreground">{doc.description}</p>
          ) : null}
        </div>
      </header>

      <DocComponent />

      {isApiReference ? null : (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          {prev ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/${locale}/docs/${prev.slug.join("/")}`}>
                <ArrowLeft className="h-4 w-4" />
                {prev.title}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/${locale}/docs/${next.slug.join("/")}`}>
                {next.title}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  const doc = getDocBySlug(slug);
  if (!doc) {
    return {};
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const path = `/${locale}/docs/${doc.slug.join("/")}`;

  return {
    title: `${doc.title} | WebLingo Docs`,
    description: doc.description,
    alternates: {
      canonical: `${baseUrl}${path}`,
      languages: Object.fromEntries(
        i18nConfig.locales.map((code) => [code, `${baseUrl}/${code}/docs/${doc.slug.join("/")}`]),
      ),
    },
  };
}
