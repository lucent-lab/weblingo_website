import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { TryPanelHeader } from "@/components/try-panel-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES_STATIC } from "@internal/dashboard/webhooks";
import { createLocalizedMetadata, resolveLocaleTranslator } from "@internal/i18n";
import { HeroOutcomeRotator } from "./components/hero-outcome-rotator";
import { HowStepsTimeline } from "./components/how-steps-timeline";
import { InViewCountUp } from "./components/in-view-count-up";
import { landingContent, type LandingSegment } from "@modules/landing/content";
import styles from "./segment-page.module.css";

type TryFormFieldLayout = "legacy" | "funnel";

export async function LandingSegmentPage({
  locale,
  segment,
  tryFormFieldLayout = "legacy",
}: {
  locale: string;
  segment: LandingSegment;
  tryFormFieldLayout?: TryFormFieldLayout;
}) {
  const content = landingContent[segment];
  const { messages, t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const hasPreviewConfig =
    Boolean(process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE) && Boolean(process.env.TRY_NOW_TOKEN);
  const supportedLanguages = SUPPORTED_LANGUAGES_STATIC;
  const shouldRotateHeroTitle = segment === "expansion";
  const heroOutcomes = content.hero.rotatorOutcomeKeys.map((outcomeKey) => t(outcomeKey));
  const howSteps = content.how.items.map((item) => ({
    title: t(item.titleKey),
    body: t(item.bodyKey),
  }));

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
              <h1 className="mb-6 text-5xl font-bold leading-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
                {shouldRotateHeroTitle ? (
                  <HeroOutcomeRotator
                    className={styles.heroTitleRotator}
                    outcomes={heroOutcomes}
                    prefix={t(content.hero.rotatorPrefixKey)}
                  />
                ) : (
                  t(content.hero.titleKey)
                )}
              </h1>
              <p className="mb-5 text-balance text-xl text-muted-foreground leading-relaxed lg:max-w-2xl">
                {t(content.hero.subtitleKey)}
              </p>
              <p className="text-sm text-muted-foreground">{t("landing.hero.guardrail")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("home.hero.trust")}</p>
            </div>
            <div className="relative lg:justify-self-end">
              <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur lg:max-w-md">
                <div className="mb-4 flex items-center">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {t("try.header.tagline")}
                  </span>
                </div>
                <TryPanelHeader messages={messages} />
                <TryForm
                  locale={locale}
                  messages={messages}
                  disabled={!hasPreviewConfig}
                  supportedLanguages={supportedLanguages}
                  showEmailField
                  showInlineStatusText={false}
                  fieldLayout={tryFormFieldLayout}
                  primaryButtonClassName={styles.buttonMicro}
                />
              </div>
            </div>
          </div>
          <div className="mt-12 grid gap-6 text-center sm:grid-cols-3">
            {content.stats.map((stat, index) => {
              const rawStatValue = t(stat.valueKey);
              const parsedStatValue = Number.parseInt(rawStatValue.replace(/[^0-9]/g, ""), 10);
              const statSuffix = rawStatValue.replace(/[0-9]/g, "").trim();
              const shouldCountUp =
                index === 0 && Number.isFinite(parsedStatValue) && parsedStatValue > 0;

              return (
                <div
                  key={stat.valueKey}
                  className={cn(
                    "rounded-2xl border border-border bg-card/80 px-6 py-5 shadow-sm",
                    styles.statCard,
                  )}
                  style={{
                    animationDelay: `${index * 110}ms`,
                  }}
                >
                  <p className="text-3xl font-semibold text-foreground">
                    {shouldCountUp ? (
                      <InViewCountUp
                        ariaLabel={`${rawStatValue} ${t(stat.labelKey)}`}
                        delayMs={index * 90}
                        suffix={statSuffix}
                        target={parsedStatValue}
                      />
                    ) : (
                      rawStatValue
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                </div>
              );
            })}
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
                <div className={styles.socialProofCallout} data-testid="social-proof-callout">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                    {t("landing.cost.callout.title")}
                  </p>
                  <div className={styles.socialProofStatGrid}>
                    <article className={styles.socialProofChip}>
                      <span className={styles.socialProofChipValue}>
                        <InViewCountUp
                          ariaLabel={t("landing.cost.callout.stat.1.value")}
                          suffix="%"
                          target={76}
                        />
                      </span>
                      <span className={styles.socialProofChipLabel}>
                        {t("landing.cost.callout.stat.1.label")}
                      </span>
                    </article>
                    <article className={styles.socialProofChip}>
                      <span className={styles.socialProofChipValue}>
                        <InViewCountUp
                          ariaLabel={t("landing.cost.callout.stat.2.value")}
                          suffix="%"
                          target={40}
                        />
                      </span>
                      <span className={styles.socialProofChipLabel}>
                        {t("landing.cost.callout.stat.2.label")}
                      </span>
                    </article>
                  </div>
                  <p className={styles.socialProofSource}>{t("landing.cost.callout.source")}</p>
                </div>
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

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
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

      <section
        id="how-it-works"
        className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.how.titleKey)}
          </h2>
          <HowStepsTimeline steps={howSteps} />
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("landing.expansion.how.risk")}
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t("landing.faq.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {[
              {
                questionKey: "landing.faq.items.1.q",
                answerKey: "landing.faq.items.1.a",
              },
              {
                questionKey: "landing.faq.items.2.q",
                answerKey: "landing.faq.items.2.a",
              },
              {
                questionKey: "landing.faq.items.3.q",
                answerKey: "landing.faq.items.3.a",
              },
              {
                questionKey: "landing.faq.items.4.q",
                answerKey: "landing.faq.items.4.a",
              },
              {
                questionKey: "landing.faq.items.5.q",
                answerKey: "landing.faq.items.5.a",
              },
              {
                questionKey: "landing.faq.items.6.q",
                answerKey: "landing.faq.items.6.a",
              },
            ].map((item) => (
              <div key={item.questionKey} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.answerKey)}</p>
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
            <Button
              asChild
              size="lg"
              className={cn("bg-primary hover:bg-primary/90", styles.buttonMicro)}
            >
              <Link href={`/${locale}#try`}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
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
