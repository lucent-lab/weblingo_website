import Link from "next/link";
import { Chakra_Petch, Space_Mono } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-3.module.css";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant3({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, chakra.variable, spaceMono.variable, "min-h-screen")}>
      <div aria-hidden className={styles.noise} />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div
          className={cn(
            styles.glass,
            "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 backdrop-blur",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/10">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(54,255,183,0.5)]" />
            </span>
            <span className={cn(styles.display, "text-base font-semibold tracking-tight text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
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
            className="rounded-full bg-primary px-4 text-primary-foreground shadow-[0_0_0_1px_rgba(54,255,183,0.25),0_10px_40px_rgba(0,0,0,0.35)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="relative px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-16">
        <div aria-hidden className={styles.orbA} />
        <div aria-hidden className={styles.orbB} />
        <div aria-hidden className={styles.grid} />

        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex items-center gap-3">
              <span className="rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                {t(content.hero.taglineKey)}
              </span>
              <span className="hidden h-px w-16 bg-border/80 sm:block" />
              <span className="hidden text-xs text-muted-foreground sm:block">{t("home.hero.trust")}</span>
            </div>

            <h1
              className={cn(
                styles.display,
                styles.glowText,
                "mt-7 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-8 grid max-w-xl gap-2 text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("landing.cta.startSmall")}</p>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-7 text-primary-foreground shadow-[0_0_0_1px_rgba(54,255,183,0.24),0_18px_70px_rgba(54,255,183,0.08)] hover:bg-primary/90"
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
                className="rounded-full border-white/20 bg-transparent px-7 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/5"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "110ms" }}>
            <div className={cn(styles.glass, "rounded-3xl p-6 backdrop-blur")}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/90">
                    {t("try.header.tagline")}
                  </div>
                  <h2 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                    {t("try.header.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
                </div>
                <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:block">
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

            <div className="mt-6 grid grid-cols-3 gap-3">
              {content.stats.map((stat) => (
                <div
                  key={stat.valueKey}
                  className={cn(
                    styles.glass,
                    "rounded-2xl px-4 py-4 text-left shadow-[0_0_0_1px_rgba(54,255,183,0.06),0_18px_50px_rgba(0,0,0,0.35)]",
                  )}
                >
                  <div className={cn(styles.display, "text-2xl font-semibold text-foreground")}>
                    {t(stat.valueKey)}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}>
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className={cn(styles.glass, "mt-8 rounded-3xl p-6")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-5">
            {content.pain.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(
                  styles.glass,
                  "rounded-3xl p-6 transition hover:shadow-[0_0_0_1px_rgba(48,212,255,0.18),0_22px_60px_rgba(0,0,0,0.45)]",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(54,255,183,0.18)]">
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
              <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}>
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div className={cn(styles.glass, "rounded-3xl p-6")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
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
                className={cn(
                  styles.glass,
                  "group rounded-3xl p-6 transition hover:shadow-[0_0_0_1px_rgba(54,255,183,0.18),0_22px_70px_rgba(0,0,0,0.55)]",
                )}
              >
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition group-hover:shadow-[0_0_0_1px_rgba(54,255,183,0.22)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className={cn(styles.display, "text-center text-3xl font-semibold text-foreground sm:text-4xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 max-w-4xl">
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-2 bottom-2 hidden w-px bg-white/10 sm:block" />
              <div className="grid gap-6">
                {content.how.items.map((step, index) => (
                  <div key={step.titleKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                      <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(54,255,183,0.16)]">
                          <span className={cn(styles.display, "text-sm font-semibold")}>{index + 1}</span>
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                          {t("nav.how")}
                        </div>
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
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className={cn(styles.glass, "rounded-3xl p-8")}>
              <h2 className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}>
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("landing.hero.guardrail")}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <div key={item.questionKey} className={cn(styles.glass, "rounded-3xl p-6")}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                    {t("nav.docs")}
                  </div>
                  <h3 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                    {t(item.questionKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.answerKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, styles.glowText, "text-3xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(54,255,183,0.22),0_22px_80px_rgba(54,255,183,0.08)] hover:bg-primary/90"
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

      <VariantSwitcher current="3" className="border-white/10 bg-black/30 text-foreground" />
    </div>
  );
}

