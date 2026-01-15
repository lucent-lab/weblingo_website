import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { listSupportedLanguagesCached } from "@internal/dashboard/data";
import { createLocalizedMetadata, resolveLocaleTranslator } from "@internal/i18n";
import { landingContent, type LandingSegment } from "@modules/landing/content";

export async function LandingSegmentPage({
  locale,
  segment,
}: {
  locale: string;
  segment: LandingSegment;
}) {
  const content = landingContent[segment];
  const { messages, t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const hasPreviewConfig =
    Boolean(process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE) && Boolean(process.env.TRY_NOW_TOKEN);
  const supportedLanguages = await listSupportedLanguagesCached();

  return (
    <div className="min-h-screen bg-background">
      <section
        id="try"
        className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32"
      >
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm">
                {t(content.hero.taglineKey)}
              </div>
              <h1 className="mb-6 text-5xl font-bold leading-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
                {t(content.hero.titleKey)}
              </h1>
              <p className="mb-8 text-balance text-xl text-muted-foreground leading-relaxed lg:max-w-2xl">
                {t(content.hero.subtitleKey)}
              </p>
              <p className="text-sm text-muted-foreground">{t("home.hero.trust")}</p>
            </div>
            <div className="relative lg:justify-self-end">
              <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur lg:max-w-md">
                <div className="mb-4 flex items-center">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {t("try.header.tagline")}
                  </span>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  {t("try.header.title")}
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">{t("try.header.description")}</p>
                <TryForm
                  locale={locale}
                  messages={messages}
                  disabled={!hasPreviewConfig}
                  supportedLanguages={supportedLanguages}
                  showEmailField
                />
              </div>
            </div>
          </div>
          <div className="mt-12 grid gap-6 text-center sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.valueKey}
                className="rounded-2xl border border-border bg-card/80 px-6 py-5 shadow-sm"
              >
                <p className="text-3xl font-semibold text-foreground">{t(stat.valueKey)}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                {t(content.pain.titleKey)}
              </h2>
              <p className="text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>
              <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/10 p-6 text-sm text-primary">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
                  {t(content.pain.costTitleKey)}
                </p>
                <p className="mt-2 text-base text-primary">{t(content.pain.costBodyKey)}</p>
              </div>
            </div>
            <div className="grid gap-6">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.useCases.titleKey)}
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-muted-foreground">
            {t(content.useCases.subtitleKey)}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className="rounded-2xl border border-border bg-card p-6 text-left"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.how.titleKey)}
          </h2>
          <div className="space-y-8">
            {content.how.items.map((item, index) => (
              <div key={item.titleKey} className="flex gap-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                  <p className="mt-1 text-muted-foreground">{t(item.bodyKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.cta.titleKey)}
          </h2>
          <p className="mb-10 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href={`/${locale}#try`}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export async function getLandingSegmentMetadata({
  locale,
  segment,
  noIndex = false,
}: {
  locale: string;
  segment: LandingSegment;
  noIndex?: boolean;
}): Promise<Metadata> {
  const content = landingContent[segment];

  const localized = await createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: content.metadata.titleKey,
    descriptionKey: content.metadata.descriptionKey,
    titleFallback: content.metadata.titleFallback,
    descriptionFallback: content.metadata.descriptionFallback,
  });

  if (!noIndex) {
    return localized;
  }

  return {
    ...localized,
    robots: {
      index: false,
      follow: false,
    },
  };
}
