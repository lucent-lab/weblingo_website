import Link from "next/link";
import { Atkinson_Hyperlegible, Baloo_2 } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-7.module.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant7({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, baloo.variable, atkinson.variable, "min-h-screen")}>
      <div aria-hidden className={styles.dots} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className={cn(styles.wobble, "inline-flex items-center gap-3")}>
            <span
              className={cn(
                styles.cardPop,
                "grid h-10 w-10 place-items-center rounded-2xl border-2 border-foreground bg-accent text-accent-foreground",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
            </span>
            <span className={cn(styles.display, "text-xl font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
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

          <Button
            asChild
            size="sm"
            className="rounded-full border-2 border-foreground bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "50ms" }}>
            <div className="inline-flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  styles.cardPop,
                  "rounded-full border-2 border-foreground bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-foreground",
                )}
              >
                {t(content.hero.taglineKey)}
              </span>
              <span className="rounded-full border-2 border-foreground bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {t("landing.cta.startSmall")}
              </span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              <span className="relative inline-block">
                <span className="absolute -inset-x-2 -inset-y-1 -z-10 rotate-[-1.2deg] rounded-[1.1rem] bg-primary/15" />
                {t(content.hero.titleKey)}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full border-2 border-foreground bg-primary px-8 text-primary-foreground shadow-none hover:bg-primary/90"
              >
                <Link href="#features">
                  {t(content.cta.primaryKey)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-2 border-foreground bg-card px-8 shadow-none hover:bg-secondary"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-2 text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("home.hero.trust")}</p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {content.stats.map((stat, idx) => (
                <div
                  key={stat.valueKey}
                  className={cn(
                    styles.cardPop,
                    styles.enter,
                    "rounded-3xl border-2 border-foreground bg-card px-6 py-6",
                  )}
                  style={{ animationDelay: `${170 + idx * 90}ms` }}
                >
                  <div
                    className={cn(
                      styles.display,
                      "text-4xl font-semibold leading-none text-foreground",
                    )}
                  >
                    {t(stat.valueKey)}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "130ms" }}>
            <div
              className={cn(
                styles.cardPop,
                "rounded-[2rem] border-2 border-foreground bg-card p-6",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border-2 border-foreground bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                    {t("try.header.tagline")}
                  </div>
                  <h2 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                    {t("try.header.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("try.header.description")}
                  </p>
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
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2
              className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
            >
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div
              className={cn(
                styles.cardPop,
                "mt-8 rounded-3xl border-2 border-foreground bg-card p-6",
              )}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(styles.cardPop, "rounded-3xl border-2 border-foreground bg-card p-6")}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl border-2 border-foreground bg-background text-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h2
                className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
              >
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div
              className={cn(styles.cardPop, "rounded-3xl border-2 border-foreground bg-card p-6")}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("nav.how")}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("landing.expansion.how.risk")}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(styles.cardPop, "rounded-3xl border-2 border-foreground bg-card p-6")}
              >
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border-2 border-foreground bg-accent text-foreground">
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
        className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24"
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

          <div className="mx-auto mt-12 grid max-w-3xl gap-6">
            {content.how.items.map((step, index) => (
              <div
                key={step.titleKey}
                className={cn(styles.cardPop, "rounded-3xl border-2 border-foreground bg-card p-6")}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      styles.display,
                      "grid h-12 w-12 place-items-center rounded-2xl border-2 border-foreground bg-primary text-primary-foreground text-lg font-semibold",
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(step.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div
              className={cn(styles.cardPop, "rounded-3xl border-2 border-foreground bg-card p-8")}
            >
              <h2
                className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
              >
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t("landing.hero.guardrail")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <details
                  key={item.questionKey}
                  className={cn(
                    styles.cardPop,
                    "group rounded-3xl border-2 border-foreground bg-card p-6",
                  )}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t(item.questionKey)}
                      </h3>
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-foreground bg-accent text-foreground transition group-open:rotate-45">
                        +
                      </span>
                    </div>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t(item.answerKey)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24">
        <div
          className={cn(
            styles.cardPop,
            "mx-auto max-w-4xl rounded-[2.2rem] border-2 border-foreground bg-card p-8 text-center sm:p-10",
          )}
        >
          <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full border-2 border-foreground bg-primary px-8 text-primary-foreground shadow-none hover:bg-primary/90"
            >
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-2 border-foreground bg-card px-8 shadow-none hover:bg-secondary"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
          </div>
        </div>
      </section>

      <VariantSwitcher current="7" className="border-2 border-foreground bg-card/90 shadow-sm" />
    </div>
  );
}
