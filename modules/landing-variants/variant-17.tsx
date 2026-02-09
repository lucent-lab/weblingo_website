import Link from "next/link";
import { Prata, Urbanist } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-17.module.css";

const prata = Prata({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-display",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant17({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, prata.variable, urbanist.variable, "min-h-screen font-sans")}>
      <div aria-hidden className={styles.grain} />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div
          className={cn(
            styles.glass,
            "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 backdrop-blur",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 shadow-[0_0_0_1px_rgba(245,158,11,0.22)]">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(245,158,11,0.35)]" />
            </span>
            <span className={cn(styles.display, "text-base font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground md:flex">
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
            className="rounded-full bg-primary px-4 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_22px_80px_rgba(0,0,0,0.55)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {t(content.hero.taglineKey)}
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-6 text-balance text-6xl font-semibold leading-[0.88] text-foreground sm:text-7xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_22px_80px_rgba(0,0,0,0.55)] hover:bg-primary/90"
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
                className="rounded-full border-white/20 bg-transparent px-8 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/5"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-2 text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("home.hero.trust")}</p>
            </div>

            <div className="mt-12 grid gap-4 border-t border-white/10 pt-10 sm:grid-cols-3">
              {content.stats.map((stat) => (
                <div
                  key={stat.valueKey}
                  className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6"
                >
                  <div
                    className={cn(
                      styles.display,
                      "text-4xl font-semibold leading-none text-foreground",
                    )}
                  >
                    {t(stat.valueKey)}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside
            className={cn(styles.enter, "lg:sticky lg:top-28")}
            style={{ animationDelay: "120ms" }}
          >
            <div className={cn(styles.glass, "rounded-3xl p-6 backdrop-blur")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
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

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                {t(content.pain.costBodyKey)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </aside>
        </div>
      </section>

      <section
        id="features"
        className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2
              className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
            >
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(245,158,11,0.18)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                      {t(item.titleKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(item.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-semibold text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(245,158,11,0.16)]">
                    <span className={cn(styles.display, "text-sm font-semibold")}>{index + 1}</span>
                  </div>
                  <div>
                    <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                      {t(step.titleKey)}
                    </h3>
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

      <section className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className={cn(styles.glass, "rounded-3xl p-8")}>
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
                  className={cn(styles.glass, "group rounded-3xl p-6")}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                        {t(item.questionKey)}
                      </h3>
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-foreground/80 transition group-open:bg-primary group-open:text-primary-foreground">
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

      <section className="border-t border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24">
        <div className={cn(styles.glass, "mx-auto max-w-4xl rounded-3xl p-8 text-center sm:p-10")}>
          <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_22px_80px_rgba(0,0,0,0.55)] hover:bg-primary/90"
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
              className="rounded-full border-white/20 bg-transparent px-8 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/5"
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

      <VariantSwitcher current="17" className="border-white/10 bg-black/30 text-foreground" />
    </div>
  );
}
