import Link from "next/link";
import { Chivo, Epilogue } from "next/font/google";
import { ArrowRight, BarChart3, Cloud, Zap } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-13.module.css";

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const chivo = Chivo({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

const capabilityItems = [
  { titleKey: "home.features.ai.title", descriptionKey: "home.features.ai.description", icon: Zap },
  {
    titleKey: "home.features.sync.title",
    descriptionKey: "home.features.sync.description",
    icon: Cloud,
  },
  {
    titleKey: "home.features.seo.title",
    descriptionKey: "home.features.seo.description",
    icon: BarChart3,
  },
] as const;

export function LandingVariant13({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, epilogue.variable, chivo.variable, "min-h-screen font-sans")}>
      <div aria-hidden className={styles.lines} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className={cn(styles.display, "text-base font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <Link href="#features" className="transition hover:text-foreground">
              {t("nav.features")}
            </Link>
            <Link href="#how-it-works" className="transition hover:text-foreground">
              {t("nav.how")}
            </Link>
            <Link href={`/${locale}/pricing`} className="transition hover:text-foreground">
              {t("nav.pricing")}
            </Link>
            <Link href={`/${locale}/docs`} className="transition hover:text-foreground">
              {t("nav.docs")}
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  styles.kicker,
                  "rounded-full border border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase text-foreground shadow-sm",
                )}
              >
                {t(content.hero.taglineKey)}
              </span>
              <span className="text-xs text-muted-foreground">{t("landing.hero.guardrail")}</span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="#features">
                  {t(content.cta.primaryKey)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-2 text-sm text-muted-foreground">
              <p>{t("home.hero.trust")}</p>
              <p>{t("landing.cta.startSmall")}</p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {capabilityItems.map((item) => (
                <div
                  key={item.titleKey}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="text-base font-semibold text-foreground">{t(item.titleKey)}</div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(item.descriptionKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={cn(styles.enter, "lg:sticky lg:top-28")} style={{ animationDelay: "120ms" }}>
            <div className={cn(styles.stack, "rounded-[1.6rem] border border-border bg-card/90 p-6 shadow-xl backdrop-blur")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                    {t("try.header.tagline")}
                  </div>
                  <h2 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                    {t("try.header.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
                </div>
                <div className="hidden rounded-2xl border border-border bg-background px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
                  {t("nav.try")}
                </div>
              </div>

              <div className="mt-6">
                <TryForm
                  locale={locale}
                  messages={messages}
                  disabled={!hasPreviewConfig}
                  supportedLanguages={supportedLanguages}
                  showEmailField
                />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {content.stats.map((stat) => (
                  <div key={stat.valueKey} className="rounded-2xl border border-border bg-background px-4 py-4">
                    <div className={cn(styles.display, "text-2xl font-semibold text-foreground")}>
                      {t(stat.valueKey)}
                    </div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {t(stat.labelKey)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="features" className="border-y border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

              <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/10 p-6 shadow-sm">
                <div className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-primary/80")}>
                  {t(content.pain.costTitleKey)}
                </div>
                <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
                <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
              </div>
            </div>

            <div className="grid gap-6">
              {content.pain.items.map((item) => (
                <div key={item.titleKey} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className={cn(styles.display, "text-center text-3xl font-semibold text-foreground sm:text-4xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 grid max-w-3xl gap-6">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex gap-5">
                  <div className={cn(styles.display, "grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground text-base font-semibold")}>
                    {index + 1}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}>
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("landing.hero.guardrail")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <details key={item.questionKey} className="group rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-sm font-semibold text-muted-foreground transition group-open:bg-primary group-open:text-primary-foreground">
                        +
                      </span>
                    </div>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(item.answerKey)}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
          </div>
        </div>
      </section>

      <VariantSwitcher current="13" />
    </div>
  );
}

