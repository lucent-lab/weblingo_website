import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-31.module.css";

export function LandingVariant31({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, "min-h-screen bg-background")}>
      {/* Hero */}
      <section
        id="try"
        className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32"
      >
        <div className={cn("absolute inset-0 -z-10", styles.heroGradient)} />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div
              className={cn("text-center lg:text-left", styles.enter)}
              style={{ animationDelay: "60ms" }}
            >
              <h1 className="mb-6 text-5xl font-bold leading-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
                {t(content.hero.titleKey)}
              </h1>
              <p className="mb-5 text-balance text-xl leading-relaxed text-muted-foreground lg:max-w-2xl">
                {t(content.hero.subtitleKey)}
              </p>
              <p className="text-sm text-muted-foreground">{t("landing.hero.guardrail")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("home.hero.trust")}</p>
            </div>

            <div
              className={cn("relative lg:justify-self-end", styles.enter)}
              style={{ animationDelay: "160ms" }}
            >
              <div
                className={cn(
                  "pointer-events-none absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl",
                  styles.formGlow,
                )}
              />
              <div
                className={cn(
                  "relative rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur lg:max-w-md",
                  styles.formCard,
                )}
              >
                <div className="mb-4 flex items-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
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
            {content.stats.map((stat, idx) => (
              <div
                key={stat.valueKey}
                className={cn(
                  "rounded-2xl border border-border bg-card/80 px-6 py-5 shadow-sm",
                  styles.enterUp,
                  styles.liftCard,
                  styles.statPulse,
                )}
                style={{ animationDelay: `${280 + idx * 100}ms` }}
              >
                <p className="text-3xl font-semibold text-foreground">{t(stat.valueKey)}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                {t(content.pain.titleKey)}
              </h2>
              <p className="text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>
              <div
                className={cn(
                  "mt-8 rounded-2xl border border-primary/20 bg-primary/10 p-6 text-sm text-primary",
                  styles.liftCard,
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
                  {t(content.pain.costTitleKey)}
                </p>
                <p className="mt-2 text-base text-primary">{t(content.pain.costBodyKey)}</p>
                <p className="mt-3 text-xs text-primary/80">{t("landing.cost.stat")}</p>
              </div>
            </div>
            <div className="grid gap-6">
              {content.pain.items.map((item, idx) => (
                <div
                  key={item.titleKey}
                  className={cn(
                    "flex gap-4 rounded-2xl border border-border bg-card p-5",
                    styles.liftCard,
                    styles.enterUp,
                  )}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
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

      {/* Use cases */}
      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.useCases.titleKey)}
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-muted-foreground">
            {t(content.useCases.subtitleKey)}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item, idx) => (
              <div
                key={item.titleKey}
                className={cn(
                  "rounded-2xl border border-border bg-card p-6 text-left",
                  styles.liftCard,
                  styles.enterUp,
                )}
                style={{ animationDelay: `${idx * 100}ms` }}
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

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.how.titleKey)}
          </h2>
          <div className="space-y-8">
            {content.how.items.map((item, index) => (
              <div
                key={item.titleKey}
                className={cn(
                  "flex gap-6",
                  styles.stepLine,
                  index === content.how.items.length - 1 && styles.stepLineLast,
                )}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground shadow-[0_4px_12px_hsl(258_60%_60%_/_0.2)]">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                  <p className="mt-1 text-muted-foreground">{t(item.bodyKey)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("landing.expansion.how.risk")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t("landing.faq.title")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div
                key={item.questionKey}
                className={cn("rounded-2xl border border-border bg-card p-6", styles.liftCard)}
              >
                <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.answerKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className={cn("mx-auto max-w-4xl text-center", styles.ctaGlow)}>
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.cta.titleKey)}
          </h2>
          <p className="mb-10 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-primary shadow-[0_4px_16px_hsl(258_60%_60%_/_0.25)] transition-shadow hover:bg-primary/90 hover:shadow-[0_6px_24px_hsl(258_60%_60%_/_0.35)]"
            >
              <Link href={`/${locale}#try`}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

      <VariantSwitcher current="31" />
    </div>
  );
}
