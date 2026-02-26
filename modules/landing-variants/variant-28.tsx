import Link from "next/link";
import { Outfit, Nunito } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-28.module.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant28({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, outfit.variable, nunito.variable, "min-h-screen")}>
      <div aria-hidden className={styles.blob1} />
      <div aria-hidden className={styles.blob2} />

      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div
          className={cn(
            styles.glass,
            "mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full px-5 py-2.5",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15">
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className={cn(styles.display, "text-sm font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-6 text-sm text-muted-foreground md:flex",
            )}
          >
            <Link href="#features" className="transition hover:text-foreground">
              {t("nav.features")}
            </Link>
            <Link href="#how-it-works" className="transition hover:text-foreground">
              {t("nav.how")}
            </Link>
            <Link href={`/${locale}/pricing`} className="transition hover:text-foreground">
              {t("nav.pricing")}
            </Link>
          </nav>

          <Button
            asChild
            size="sm"
            className="rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(167,139,250,0.25)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <div className="mx-auto max-w-5xl">
          <div
            className={cn(styles.enter, "mx-auto max-w-3xl text-center")}
            style={{ animationDelay: "40ms" }}
          >
            <div
              className={cn(
                styles.glass,
                "inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-primary",
              )}
            >
              {t(content.hero.taglineKey)}
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-8 text-balance text-5xl font-bold leading-[0.92] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p
              className={cn(
                styles.body,
                "mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground",
              )}
            >
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_8px_30px_rgba(167,139,250,0.3)] hover:bg-primary/90 hover:shadow-[0_8px_40px_rgba(167,139,250,0.4)]"
              >
                <Link href="#features">
                  {t(content.cta.primaryKey)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className={cn(styles.glass, "rounded-full px-8 text-foreground hover:bg-white/70")}
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <p className={cn(styles.body, "mt-6 text-sm text-muted-foreground")}>
              {t("landing.cta.risk")} &middot; {t("home.hero.trust")}
            </p>
          </div>

          <div
            className={cn(
              styles.enter,
              styles.glassStrong,
              "mx-auto mt-12 max-w-3xl rounded-3xl p-6",
            )}
            style={{ animationDelay: "140ms" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold text-primary">{t("try.header.tagline")}</div>
                <h2 className={cn(styles.display, "mt-2 text-lg font-bold text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-1 text-sm text-muted-foreground")}>
                  {t("try.header.description")}
                </p>
              </div>
            </div>
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

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.valueKey}
                className={cn(styles.glass, "rounded-2xl px-6 py-5 text-center")}
              >
                <p className={cn(styles.display, "text-3xl font-bold text-primary")}>
                  {t(stat.valueKey)}
                </p>
                <p className={cn(styles.body, "mt-2 text-xs text-muted-foreground")}>
                  {t(stat.labelKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className={cn(styles.display, "text-3xl font-bold text-foreground sm:text-4xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-4 text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <div className={cn(styles.glassStrong, "mt-8 rounded-2xl p-6")}>
                <div className="text-xs font-semibold text-primary">
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
                    styles.glass,
                    "rounded-2xl p-5 transition hover:shadow-[0_12px_40px_rgba(167,139,250,0.12)]",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
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
        <div className="mx-auto max-w-5xl text-center">
          <h2 className={cn(styles.display, "text-3xl font-bold text-foreground sm:text-4xl")}>
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mx-auto mt-4 max-w-2xl text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-12 grid gap-4 text-left md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(
                  styles.glass,
                  "rounded-2xl p-6 transition hover:shadow-[0_12px_40px_rgba(167,139,250,0.12)]",
                )}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-base font-bold text-foreground")}>
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

      <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-12 space-y-4">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.glass, "rounded-2xl p-6")}>
                <div className="flex items-start gap-5">
                  <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(167,139,250,0.3)]">
                    <span className={cn(styles.display, "text-sm font-bold")}>{index + 1}</span>
                  </div>
                  <div>
                    <h3 className={cn(styles.display, "text-base font-bold text-foreground")}>
                      {t(step.titleKey)}
                    </h3>
                    <p className={cn(styles.body, "mt-1 text-sm text-muted-foreground")}>
                      {t(step.bodyKey)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className={cn(styles.glass, "rounded-2xl p-6")}>
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

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className={cn(styles.glassStrong, "mx-auto max-w-3xl rounded-3xl p-10 text-center")}>
          <h2 className={cn(styles.display, "text-3xl font-bold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-5 text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_8px_30px_rgba(167,139,250,0.3)] hover:bg-primary/90"
            >
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className={cn(styles.glass, "rounded-full px-8 text-foreground hover:bg-white/70")}
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-sm text-muted-foreground")}>
            {t("landing.cta.startSmall")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="28" />
    </div>
  );
}
