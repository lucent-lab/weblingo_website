import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TryForm } from "@/components/try-form";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";
import { SUPPORTED_LANGUAGES_STATIC } from "@internal/dashboard/webhooks";

export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { messages, t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  const hasPreviewConfig =
    Boolean(process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE) && Boolean(process.env.TRY_NOW_TOKEN);
  const supportedLanguages = SUPPORTED_LANGUAGES_STATIC;

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-block rounded-full border border-border bg-secondary px-4 py-2">
            <span className="text-sm font-medium text-secondary-foreground">
              {t("try.header.tagline")}
            </span>
          </div>
          <h1 className="mb-6 text-5xl font-bold text-balance text-foreground sm:text-6xl">
            {t("try.header.title")}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-balance text-lg text-muted-foreground">
            {t("try.header.description")}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-8 sm:p-12">
            <TryForm
              locale={locale}
              messages={messages}
              disabled={!hasPreviewConfig}
              supportedLanguages={supportedLanguages}
              showEmailField
            />
            {!hasPreviewConfig ? (
              <div className="mt-8 rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
                {t("try.disabled.notice")}
              </div>
            ) : null}
          </div>
        </div>
      </section>
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
    titleKey: "try.header.title",
    descriptionKey: "try.header.description",
    titleFallback: "Try Your URL",
    descriptionFallback:
      "Preview a translated version of your website and see how it would look hosted globally.",
  });
}
