import Link from "next/link";
import { Commissioner, Gloock } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-9.module.css";

const gloock = Gloock({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-display",
});

const commissioner = Commissioner({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant9({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, gloock.variable, commissioner.variable, "min-h-screen")}>
      <div aria-hidden className={styles.paper} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className={cn(styles.display, "text-base font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className={cn(styles.kicker, "hidden items-center gap-7 text-[11px] font-semibold uppercase text-muted-foreground md:flex")}>
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
        <div className="mx-auto max-w-6xl">
          <div className={cn(styles.enter, "grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14")} style={{ animationDelay: "40ms" }}>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-muted-foreground")}>
                  {t(content.hero.taglineKey)}
                </span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">{t("landing.cta.startSmall")}</span>
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
                <p>{t("landing.hero.guardrail")}</p>
                <p>{t("home.hero.trust")}</p>
              </div>

              <div className="mt-12 rounded-2xl border border-border bg-card p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <div className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-muted-foreground")}>
                    {t("nav.features")}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("landing.cta.startSmall")}</div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {content.stats.map((stat) => (
                    <div key={stat.valueKey} className="border-l border-border pl-4 first:border-l-0 first:pl-0">
                      <div className={cn(styles.display, "text-3xl font-semibold text-foreground")}>
                        {t(stat.valueKey)}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{t(stat.labelKey)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="lg:sticky lg:top-28">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={cn(styles.kicker, "inline-flex text-[11px] font-semibold uppercase text-muted-foreground")}>
                      {t("try.header.tagline")}
                    </div>
                    <h2 className={cn(styles.display, "mt-3 text-lg font-semibold text-foreground")}>
                      {t("try.header.title")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
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
        </div>
      </section>

      <section className="border-y border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2 className={cn(styles.display, "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl")}>
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className="mt-8 rounded-2xl border border-border bg-card p-6">
              <div className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-muted-foreground")}>
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <div className="mt-4">
                <div className={styles.rule} />
                <p className="mt-4 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div key={item.titleKey} className="rounded-2xl border border-border bg-card p-6">
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
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h2 className={cn(styles.display, "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl")}>
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className={cn(styles.kicker, "text-[11px] font-semibold uppercase text-muted-foreground")}>
                {t("nav.how")}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("landing.expansion.how.risk")}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/25">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className={cn(styles.display, "text-center text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 max-w-3xl border-t border-border">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="grid gap-4 border-b border-border py-8 sm:grid-cols-[72px_1fr]">
                <div className={cn(styles.display, "text-4xl font-semibold leading-none text-primary")}>
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>
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
            <div className="rounded-2xl border border-border bg-card p-8">
              <h2 className={cn(styles.display, "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl")}>
                {t("landing.faq.title")}
              </h2>
              <div className="mt-4">
                <div className={styles.rule} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("landing.hero.guardrail")}</p>
            </div>

            <div className="grid gap-0 rounded-2xl border border-border bg-card">
              {LANDING_FAQ_ITEMS.map((item, idx) => (
                <div key={item.questionKey} className={cn("p-6", idx !== 0 ? "border-t border-border" : null)}>
                  <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.answerKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-secondary/55 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-4xl font-semibold leading-[0.9] text-foreground sm:text-6xl")}>
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

      <VariantSwitcher current="9" />
    </div>
  );
}

