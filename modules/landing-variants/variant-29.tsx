import Link from "next/link";
import { Orbitron, Exo_2 } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-29.module.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const exo2 = Exo_2({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant29({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, orbitron.variable, exo2.variable, "min-h-screen")}>
      <div aria-hidden className={styles.gridFloor} />
      <div aria-hidden className={styles.sunGlow} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className={cn(styles.display, styles.chromeText, "text-base font-bold")}>
              WEBLINGO
            </span>
          </Link>

          <nav
            className={cn(
              styles.display,
              "hidden items-center gap-6 text-[10px] text-muted-foreground md:flex",
            )}
          >
            <Link href="#features" className="transition hover:text-primary">
              {t("nav.features")}
            </Link>
            <Link href="#how-it-works" className="transition hover:text-primary">
              {t("nav.how")}
            </Link>
            <Link href={`/${locale}/pricing`} className="transition hover:text-primary">
              {t("nav.pricing")}
            </Link>
          </nav>

          <Button
            asChild
            size="sm"
            className="rounded-sm bg-primary text-primary-foreground shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-primary/90"
          >
            <Link href="#try" className={styles.display}>
              {t("nav.try")}
            </Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={styles.enter} style={{ animationDelay: "40ms" }}>
              <div
                className={cn(
                  styles.display,
                  "inline-block rounded-sm border border-primary/30 bg-primary/10 px-4 py-2 text-[10px] text-primary",
                )}
              >
                {t(content.hero.taglineKey)}
              </div>

              <h1
                className={cn(
                  styles.chromeText,
                  styles.display,
                  "mt-8 text-5xl font-bold leading-[0.92] sm:text-6xl lg:text-7xl",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p
                className={cn(
                  styles.body,
                  "mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground",
                )}
              >
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="rounded-sm bg-primary px-8 text-primary-foreground shadow-[0_0_30px_rgba(236,72,153,0.25)] hover:bg-primary/90"
                >
                  <Link href="#features" className={styles.display}>
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="rounded-sm border border-accent/30 bg-accent/10 px-8 text-accent shadow-[0_0_20px_rgba(56,189,248,0.1)] hover:bg-accent/20"
                >
                  <a href="mailto:contact@weblingo.app" className={styles.display}>
                    {t(content.cta.secondaryKey)}
                  </a>
                </Button>
              </div>

              <div className={cn(styles.body, "mt-6 text-xs text-muted-foreground")}>
                {t("landing.cta.risk")} &middot; {t("home.hero.trust")}
              </div>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "120ms" }}>
              <div className={cn(styles.retroPanel, "rounded-lg p-6")}>
                <div className={cn(styles.display, "text-[10px] text-accent")}>
                  {t("try.header.tagline")}
                </div>
                <h2 className={cn(styles.display, "mt-3 text-base font-bold text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-1 text-sm text-muted-foreground")}>
                  {t("try.header.description")}
                </p>
                <div className="mt-5">
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

          <div className="mt-14 grid gap-3 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.valueKey}
                className={cn(styles.retroPanel, "rounded-lg px-6 py-5 text-center")}
              >
                <p className={cn(styles.display, styles.chromeText, "text-3xl font-bold")}>
                  {t(stat.valueKey)}
                </p>
                <p className={cn(styles.display, "mt-2 text-[9px] text-muted-foreground")}>
                  {t(stat.labelKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2
                className={cn(styles.display, styles.chromeText, "text-3xl font-bold sm:text-4xl")}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-4 text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <div className={cn(styles.retroPanel, "mt-8 rounded-lg p-6")}>
                <div className={cn(styles.display, "text-[10px] text-primary")}>
                  {t(content.pain.costTitleKey)}
                </div>
                <p className={cn(styles.body, "mt-3 text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-2 text-xs text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className={cn(
                    styles.retroPanel,
                    "rounded-lg p-5 transition hover:border-primary/30",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-sm bg-primary/15 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn(styles.body, "font-semibold text-foreground")}>
                        {t(item.titleKey)}
                      </h3>
                      <p className={cn(styles.body, "mt-1 text-sm text-muted-foreground")}>
                        {t(item.bodyKey)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t(content.useCases.titleKey)}
          </h2>
          <p
            className={cn(styles.body, "mx-auto mt-4 max-w-2xl text-center text-muted-foreground")}
          >
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(
                  styles.retroPanel,
                  "rounded-lg p-6 transition hover:border-accent/30",
                )}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-sm bg-accent/15 text-accent">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-xs font-bold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2
            className={cn(
              styles.display,
              styles.chromeText,
              "text-center text-3xl font-bold sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.retroPanel, "rounded-lg p-6")}>
                <div className={cn(styles.display, styles.chromeText, "text-4xl font-bold")}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className={cn(styles.display, "mt-4 text-xs font-bold text-foreground")}>
                  {t(step.titleKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                  {t(step.bodyKey)}
                </p>
              </div>
            ))}
          </div>

          <p className={cn(styles.body, "mt-10 text-center text-sm text-muted-foreground")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t("landing.faq.title")}
          </h2>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className={cn(styles.retroPanel, "rounded-lg p-6")}>
                <h3 className={cn(styles.body, "font-semibold text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className={cn(styles.display, styles.chromeText, "text-4xl font-bold sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-5 text-lg text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-sm bg-primary px-8 text-primary-foreground shadow-[0_0_30px_rgba(236,72,153,0.25)] hover:bg-primary/90"
            >
              <Link href="#try" className={styles.display}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="rounded-sm border border-accent/30 bg-accent/10 px-8 text-accent hover:bg-accent/20"
            >
              <a href="mailto:contact@weblingo.app" className={styles.display}>
                {t(content.cta.secondaryKey)}
              </a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-sm text-muted-foreground")}>
            {t("landing.cta.startSmall")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="29" className="border-border bg-background/60 backdrop-blur" />
    </div>
  );
}
