import Link from "next/link";
import { Public_Sans, Spectral } from "next/font/google";
import { ArrowRight, BarChart3, Cloud, ShieldCheck, Zap } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-18.module.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

const featureItems = [
  {
    titleKey: "home.features.ai.title",
    descriptionKey: "home.features.ai.description",
    icon: Zap,
  },
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

export function LandingVariant18({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div
      className={cn(styles.root, spectral.variable, publicSans.variable, "min-h-screen font-sans")}
    >
      <div aria-hidden className={styles.hatch} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className={cn(styles.seal, "grid h-9 w-9 place-items-center rounded-xl")}>
              <ShieldCheck className="h-5 w-5 text-primary" />
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
            <Link href="#faq" className="transition hover:text-foreground">
              {t("nav.faq")}
            </Link>
            <Link href={`/${locale}/pricing`} className="transition hover:text-foreground">
              {t("nav.pricing")}
            </Link>
          </nav>

          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.06fr_0.94fr] lg:gap-14">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div
              className={cn(styles.kicker, "text-xs font-semibold uppercase text-muted-foreground")}
            >
              {t(content.hero.taglineKey)}
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-6 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
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
              <p>{t("landing.cta.risk")}</p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {content.stats.map((stat, idx) => (
                <div
                  key={stat.valueKey}
                  className="rounded-3xl border border-border bg-card/90 px-6 py-6 shadow-sm"
                  style={{ animationDelay: `${160 + idx * 90}ms` }}
                >
                  <div
                    className={cn(
                      styles.display,
                      "text-4xl font-semibold leading-none text-foreground",
                    )}
                  >
                    {t(stat.valueKey)}
                  </div>
                  <div
                    className={cn(
                      styles.kicker,
                      "mt-3 text-[11px] font-semibold uppercase text-muted-foreground",
                    )}
                  >
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
            <div
              className={cn(
                styles.seal,
                "rounded-3xl border border-border bg-card/90 p-6 shadow-xl",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={cn(
                      styles.kicker,
                      "text-[11px] font-semibold uppercase tracking-[0.24em] text-primary",
                    )}
                  >
                    {t("try.header.tagline")}
                  </div>
                  <h2 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                    {t("try.header.title")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("try.header.description")}
                  </p>
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
            </div>

            <div className="mt-6 grid gap-4">
              {featureItems.map((item) => (
                <div
                  key={item.titleKey}
                  className="rounded-3xl border border-border bg-card px-6 py-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t(item.titleKey)}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t(item.descriptionKey)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section
        id="features"
        className="border-y border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <h2
                className={cn(styles.display, "text-3xl font-semibold text-foreground sm:text-4xl")}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

              <div className="mt-8 rounded-3xl border border-primary/15 bg-primary/5 p-6">
                <div
                  className={cn(
                    styles.kicker,
                    "text-[11px] font-semibold uppercase text-primary/80",
                  )}
                >
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
                  className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
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

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-foreground/5 text-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-lg font-semibold text-foreground">{t(item.titleKey)}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.bodyKey)}
                </div>
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

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div
                key={step.titleKey}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_60px_rgba(14,116,144,0.22)]">
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

          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="#try">{t(content.cta.primaryKey)}</Link>
            </Button>
            <div className="text-sm text-muted-foreground">{t("landing.cta.startSmall")}</div>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="border-t border-border bg-secondary/40 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-semibold text-foreground sm:text-4xl",
            )}
          >
            {t("landing.faq.title")}
          </h2>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div
                key={item.questionKey}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="text-base font-semibold text-foreground">{t(item.questionKey)}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.answerKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <VariantSwitcher current="18" />
    </div>
  );
}
