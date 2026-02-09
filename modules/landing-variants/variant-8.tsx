import Link from "next/link";
import { Cardo, Cinzel } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-8.module.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant8({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, cinzel.variable, cardo.variable, "min-h-screen")}>
      <div aria-hidden className={styles.rays} />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_20px_rgba(245,158,11,0.25)]" />
            </span>
            <span
              className={cn(
                styles.display,
                "text-base font-semibold tracking-[0.06em] text-foreground",
              )}
            >
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
            className="rounded-full bg-primary px-4 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_20px_60px_rgba(0,0,0,0.45)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="relative px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div aria-hidden className={styles.borderFrame} />

        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className={cn(styles.decoRule, "text-center")}>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/90">
                {t(content.hero.taglineKey)}
              </span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-center text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-center text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("home.hero.trust")}</p>
            </div>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_22px_70px_rgba(0,0,0,0.55)] hover:bg-primary/90"
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

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
              {content.stats.map((stat, idx) => (
                <div
                  key={stat.valueKey}
                  className={cn(styles.glass, "rounded-3xl px-6 py-6 text-center")}
                  style={{ animationDelay: `${160 + idx * 90}ms` }}
                >
                  <div className={cn(styles.display, "text-3xl font-semibold text-foreground")}>
                    {t(stat.valueKey)}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "120ms" }}>
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
                <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
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
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2
              className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
            >
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className={cn(styles.glass, "mt-8 rounded-3xl p-6")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(245,158,11,0.14)]">
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
            <div className={cn(styles.glass, "rounded-3xl p-6")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                {t("nav.how")}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("landing.expansion.how.risk")}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent shadow-[0_0_0_1px_rgba(34,197,159,0.14)]">
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

      <section
        id="how-it-works"
        className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24"
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

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                <div className="flex items-center justify-between gap-4">
                  <div className={cn(styles.display, "text-2xl font-semibold text-primary")}>
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <h3 className={cn(styles.display, "mt-4 text-lg font-semibold text-foreground")}>
                  {t(step.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(step.bodyKey)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
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
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_22px_70px_rgba(0,0,0,0.55)] hover:bg-primary/90"
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

      <VariantSwitcher current="8" className="border-white/10 bg-black/30 text-foreground" />
    </div>
  );
}
