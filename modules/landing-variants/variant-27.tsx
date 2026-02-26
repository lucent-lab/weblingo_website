import Link from "next/link";
import { Unbounded, Red_Hat_Mono } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-27.module.css";

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const redHatMono = Red_Hat_Mono({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-mono",
});

export function LandingVariant27({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, unbounded.variable, redHatMono.variable, "min-h-screen")}>
      <div aria-hidden className={styles.neonGlow} />

      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div
          className={cn(
            styles.neonCard,
            "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-5 py-3 backdrop-blur",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/20">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_14px_rgba(255,51,153,0.5)]" />
            </span>
            <span className={cn(styles.display, "text-sm font-bold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.mono,
              "hidden items-center gap-5 text-[10px] uppercase text-muted-foreground md:flex",
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
            className="rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_rgba(255,51,153,0.25)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={styles.enter} style={{ animationDelay: "40ms" }}>
              <div
                className={cn(
                  styles.mono,
                  "inline-flex items-center rounded-full border-2 border-primary/30 bg-primary/10 px-4 py-2 text-[10px] uppercase text-primary",
                )}
              >
                {t(content.hero.taglineKey)}
              </div>

              <h1
                className={cn(
                  styles.display,
                  styles.neonPrimary,
                  "mt-8 text-5xl font-bold leading-[0.88] text-foreground sm:text-6xl lg:text-7xl",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_40px_rgba(255,51,153,0.2)] hover:bg-primary/90"
                >
                  <Link href="#features">
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="rounded-full border-2 border-accent/30 bg-accent/10 px-8 text-accent shadow-[0_0_20px_rgba(0,255,170,0.08)] hover:bg-accent/20"
                >
                  <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
                </Button>
              </div>

              <div className={cn(styles.mono, "mt-6 text-[10px] uppercase text-muted-foreground")}>
                {t("landing.cta.risk")} &middot; {t("home.hero.trust")}
              </div>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "100ms" }}>
              <div className={cn(styles.neonCard, "rounded-3xl p-6 backdrop-blur")}>
                <div className={cn(styles.mono, "text-[10px] uppercase text-accent")}>
                  {t("try.header.tagline")}
                </div>
                <h2 className={cn(styles.display, "mt-3 text-lg font-bold text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
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

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.valueKey}
                className={cn(styles.neonCard, "rounded-2xl px-6 py-6 text-center")}
              >
                <p
                  className={cn(
                    styles.display,
                    styles.neonAccent,
                    "text-4xl font-bold text-accent",
                  )}
                >
                  {t(stat.valueKey)}
                </p>
                <p className={cn(styles.mono, "mt-2 text-[10px] uppercase text-muted-foreground")}>
                  {t(stat.labelKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2
                className={cn(
                  styles.display,
                  styles.neonPrimary,
                  "text-3xl font-bold text-foreground sm:text-4xl",
                )}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className="mt-4 text-muted-foreground">{t(content.pain.subtitleKey)}</p>

              <div className={cn(styles.neonCard, "mt-8 rounded-2xl p-6")}>
                <div className={cn(styles.mono, "text-[10px] uppercase text-primary")}>
                  {t(content.pain.costTitleKey)}
                </div>
                <p className="mt-3 text-foreground">{t(content.pain.costBodyKey)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className={cn(styles.neonCard, "rounded-2xl p-5 transition")}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t(item.titleKey)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
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
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(styles.neonCard, "rounded-2xl p-6 transition")}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-base font-bold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y-2 border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2
            className={cn(
              styles.display,
              styles.neonPrimary,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-12 space-y-4">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.neonCard, "rounded-2xl p-6")}>
                <div className="flex items-start gap-5">
                  <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_30px_rgba(255,51,153,0.15)]">
                    <span className={cn(styles.display, "text-lg font-bold")}>{index + 1}</span>
                  </div>
                  <div>
                    <h3 className={cn(styles.display, "text-base font-bold text-foreground")}>
                      {t(step.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(step.bodyKey)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p
            className={cn(
              styles.mono,
              "mt-8 text-center text-[10px] uppercase text-muted-foreground",
            )}
          >
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

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className={cn(styles.neonCard, "rounded-2xl p-6")}>
                <h3 className="font-semibold text-foreground">{t(item.questionKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.answerKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t-2 border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className={cn(
              styles.display,
              styles.neonPrimary,
              "text-4xl font-bold text-foreground sm:text-5xl",
            )}
          >
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_40px_rgba(255,51,153,0.2)] hover:bg-primary/90"
            >
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="rounded-full border-2 border-accent/30 bg-accent/10 px-8 text-accent hover:bg-accent/20"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t("landing.cta.startSmall")}</p>
        </div>
      </section>

      <VariantSwitcher current="27" className="border-border bg-background/40 backdrop-blur" />
    </div>
  );
}
