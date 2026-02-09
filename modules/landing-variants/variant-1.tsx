import Link from "next/link";
import { Fraunces, Spline_Sans } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-1.module.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const splineSans = Spline_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant1({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, fraunces.variable, splineSans.variable, "min-h-screen")}>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="group inline-flex items-baseline gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card shadow-sm transition group-hover:-rotate-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className={cn(styles.display, "text-xl font-semibold text-foreground")}>
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

          <Button asChild size="sm" className="rounded-full">
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
          <div className={cn(styles.enter, "pt-2")} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex items-center gap-3">
              <span
                className={cn(
                  styles.kicker,
                  "rounded-full border border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase text-foreground shadow-sm",
                )}
              >
                {t(content.hero.taglineKey)}
              </span>
              <span className="hidden h-px w-16 bg-border sm:block" />
              <span className="hidden text-xs text-muted-foreground sm:block">
                {t("landing.hero.guardrail")}
              </span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-6 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              <span className="relative">
                <span className="absolute -inset-x-2 -inset-y-1 -z-10 rotate-[-1.2deg] rounded-xl bg-primary/10" />
                {t(content.hero.titleKey)}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-6 grid max-w-xl gap-2 text-sm text-muted-foreground">
              <p>{t("home.hero.trust")}</p>
              <p>{t("landing.cta.startSmall")}</p>
            </div>

            <div
              className={cn(styles.enterSoft, "mt-10 flex flex-wrap gap-3")}
              style={{ animationDelay: "160ms" }}
            >
              <Button asChild size="lg" className="rounded-full">
                <Link href="#features">
                  {t(content.cta.primaryKey)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>
          </div>

          <aside className={cn(styles.enter, "relative")} style={{ animationDelay: "90ms" }}>
            <div className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-primary/10 blur-2xl" />
            <div className="relative rounded-[1.4rem] border border-border bg-card/90 p-6 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={cn(
                      styles.kicker,
                      "inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase text-primary",
                    )}
                  >
                    {t("try.header.tagline")}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">
                    {t("try.header.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("try.header.description")}
                  </p>
                </div>
                <div className="hidden rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground sm:block">
                  <span className={styles.kicker}>{t("nav.features")}</span>
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
            </div>
          </aside>
        </div>

        <div className="mx-auto mt-14 max-w-6xl border-t border-border/70 pt-10 sm:mt-16 sm:pt-12">
          <div className="grid gap-6 sm:grid-cols-3">
            {content.stats.map((stat, idx) => (
              <div
                key={stat.valueKey}
                className={cn(
                  "rounded-2xl border border-border bg-card/70 px-6 py-6 shadow-sm",
                  styles.enterSoft,
                )}
                style={{ animationDelay: `${220 + idx * 80}ms` }}
              >
                <p className={cn(styles.display, "text-4xl font-semibold text-foreground")}>
                  {t(stat.valueKey)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-secondary/40 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2
              className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
            >
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className="mt-8 rounded-2xl border border-primary/25 bg-primary/10 p-6">
              <p
                className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-primary/80")}
              >
                {t(content.pain.costTitleKey)}
              </p>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div
                key={item.titleKey}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition group-hover:-rotate-2">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {t(item.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h2
                className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
              >
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p
                className={cn(
                  styles.kicker,
                  "text-[11px] font-semibold uppercase text-muted-foreground",
                )}
              >
                {t("nav.how")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("landing.expansion.how.risk")}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-border/70 bg-secondary/40 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-semibold text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-12 grid gap-8">
            {content.how.items.map((step, index) => (
              <div
                key={step.titleKey}
                className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-[72px_1fr] sm:items-start"
              >
                <div className="flex items-center gap-4 sm:block">
                  <div
                    className={cn(
                      styles.display,
                      "flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background text-2xl font-semibold text-foreground shadow-sm",
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="sm:hidden">
                    <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(step.bodyKey)}</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <h2
                className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
              >
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t("landing.hero.guardrail")}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <div
                  key={item.questionKey}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(item.answerKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 bg-secondary/40 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
          </div>
        </div>
      </section>

      <VariantSwitcher current="1" />
    </div>
  );
}
