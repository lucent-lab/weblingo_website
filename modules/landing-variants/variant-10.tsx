import Link from "next/link";
import { Azeret_Mono, Bungee } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-10.module.css";

const bungee = Bungee({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-display",
});

const azeret = Azeret_Mono({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant10({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, bungee.variable, azeret.variable, "min-h-screen")}>
      <div aria-hidden className={styles.halftone} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className={cn(
              styles.sticker,
              "inline-flex items-center gap-3 rounded-2xl bg-card px-4 py-2",
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className={cn(styles.display, "text-base font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.mono,
              "hidden items-center gap-6 text-[11px] font-semibold uppercase text-muted-foreground md:flex",
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
            <Link href={`/${locale}/docs`} className="transition hover:text-foreground">
              {t("nav.docs")}
            </Link>
          </nav>

          <Button
            asChild
            size="sm"
            className="rounded-full border-2 border-border bg-accent px-4 text-accent-foreground shadow-none hover:bg-accent/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "50ms" }}>
            <div
              className={cn(
                styles.sticker,
                "inline-flex items-center rounded-full bg-card px-4 py-2",
              )}
            >
              <span
                className={cn(styles.mono, "text-[11px] font-semibold uppercase text-foreground")}
              >
                {t(content.hero.taglineKey)}
              </span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-5xl font-semibold leading-[0.95] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              <span className="relative inline-block">
                <span
                  className={cn(
                    styles.sticker,
                    "absolute -inset-x-3 -inset-y-2 -z-10 rotate-[-1.2deg] rounded-[1.6rem] bg-primary/20",
                  )}
                />
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
                className="rounded-full border-2 border-border bg-primary px-8 text-primary-foreground shadow-none hover:bg-primary/90"
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
                className="rounded-full border-2 border-border bg-card px-8 shadow-none hover:bg-secondary"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-2 text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("home.hero.trust")}</p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {content.stats.map((stat, idx) => (
                <div
                  key={stat.valueKey}
                  className={cn(styles.sticker, styles.enter, "rounded-3xl bg-card px-6 py-6")}
                  style={{
                    animationDelay: `${180 + idx * 90}ms`,
                    transform: `rotate(${idx % 2 === 0 ? -1.1 : 1.0}deg)`,
                  }}
                >
                  <div className={cn(styles.display, "text-3xl font-semibold text-foreground")}>
                    {t(stat.valueKey)}
                  </div>
                  <div
                    className={cn(
                      styles.mono,
                      "mt-2 text-[10px] font-semibold uppercase text-muted-foreground",
                    )}
                  >
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "130ms" }}>
            <div
              className={cn(styles.sticker, styles.jitter, "relative rounded-[2rem] bg-card p-6")}
            >
              <div aria-hidden className={cn(styles.tape, "left-8 top-[-10px]")} />
              <div aria-hidden className={cn(styles.tape, "right-8 top-[-10px] rotate-[10deg]")} />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={cn(
                      styles.mono,
                      "inline-flex rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase text-secondary-foreground",
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

      <section className="border-y-2 border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2
              className={cn(
                styles.display,
                "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl",
              )}
            >
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className={cn(styles.sticker, "mt-8 rounded-3xl bg-card p-6")}>
              <div
                className={cn(
                  styles.mono,
                  "text-[10px] font-semibold uppercase text-muted-foreground",
                )}
              >
                {t(content.pain.costTitleKey)}
              </div>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item, idx) => (
              <div
                key={item.titleKey}
                className={cn(styles.sticker, "rounded-3xl bg-card p-6")}
                style={{ transform: `rotate(${idx % 2 === 0 ? -0.8 : 0.7}deg)` }}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
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
                className={cn(
                  styles.display,
                  "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl",
                )}
              >
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div className={cn(styles.sticker, "rounded-3xl bg-card p-6")}>
              <div
                className={cn(
                  styles.mono,
                  "text-[10px] font-semibold uppercase text-muted-foreground",
                )}
              >
                {t("nav.how")}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("landing.expansion.how.risk")}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item, idx) => (
              <div
                key={item.titleKey}
                className={cn(styles.sticker, "rounded-3xl bg-card p-6")}
                style={{ transform: `rotate(${idx === 1 ? 0.9 : -0.6}deg)` }}
              >
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
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
        className="border-y-2 border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.sticker, "rounded-3xl bg-card p-6")}>
                <div className="flex items-center justify-between gap-4">
                  <div className={cn(styles.display, "text-xl font-semibold text-foreground")}>
                    {index + 1}
                  </div>
                  <div
                    className={cn(
                      styles.mono,
                      "text-[10px] font-semibold uppercase text-muted-foreground",
                    )}
                  >
                    {t("nav.how")}
                  </div>
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
            <div className={cn(styles.sticker, "rounded-3xl bg-card p-8")}>
              <h2
                className={cn(
                  styles.display,
                  "text-4xl font-semibold leading-[0.95] text-foreground sm:text-5xl",
                )}
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
                  className={cn(styles.sticker, "group rounded-3xl bg-card p-6")}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t(item.questionKey)}
                      </h3>
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-border bg-accent text-accent-foreground transition group-open:rotate-45">
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

      <section className="border-t-2 border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div
          className={cn(
            styles.sticker,
            "mx-auto max-w-4xl rounded-[2.2rem] bg-card p-8 text-center sm:p-10",
          )}
        >
          <h2
            className={cn(
              styles.display,
              "text-4xl font-semibold leading-[0.9] text-foreground sm:text-6xl",
            )}
          >
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full border-2 border-border bg-primary px-8 text-primary-foreground shadow-none hover:bg-primary/90"
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
              className="rounded-full border-2 border-border bg-card px-8 shadow-none hover:bg-secondary"
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

      <VariantSwitcher current="10" className="border-2 border-border bg-card/90 shadow-sm" />
    </div>
  );
}
