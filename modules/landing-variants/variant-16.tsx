import Link from "next/link";
import { Archivo, Bai_Jamjuree } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-16.module.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const bai = Bai_Jamjuree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant16({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, archivo.variable, bai.variable, "min-h-screen font-sans")}>
      <header className="sticky top-0 z-40 border-b-2 border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border-2 border-border bg-card">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span
              className={cn(styles.display, "text-xl font-semibold leading-none text-foreground")}
            >
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link
              href="#features"
              className="border-b-2 border-transparent hover:border-foreground"
            >
              {t("nav.features")}
            </Link>
            <Link
              href="#how-it-works"
              className="border-b-2 border-transparent hover:border-foreground"
            >
              {t("nav.how")}
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="border-b-2 border-transparent hover:border-foreground"
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href={`/${locale}/docs`}
              className="border-b-2 border-transparent hover:border-foreground"
            >
              {t("nav.docs")}
            </Link>
          </nav>

          <Button
            asChild
            size="sm"
            className="rounded-full border-2 border-border bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  styles.kicker,
                  "rounded-full border-2 border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase text-foreground",
                )}
              >
                {t(content.hero.taglineKey)}
              </span>
              <span className="text-xs text-muted-foreground">{t("landing.hero.guardrail")}</span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-6xl font-semibold leading-[0.88] text-foreground sm:text-7xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
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
              <p>{t("home.hero.trust")}</p>
              <p>{t("landing.cta.startSmall")}</p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {content.stats.map((stat, idx) => (
                <div
                  key={stat.valueKey}
                  className={cn(
                    styles.frame,
                    styles.enter,
                    "rounded-3xl border-2 border-border bg-card px-6 py-6",
                  )}
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
                      "mt-3 text-[10px] font-semibold uppercase text-muted-foreground",
                    )}
                  >
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "120ms" }}>
            <div className={cn(styles.frame, "rounded-[2rem] border-2 border-border bg-card p-6")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={cn(
                      styles.kicker,
                      "inline-flex rounded-full border-2 border-border bg-secondary px-3 py-1 text-[10px] font-semibold uppercase text-secondary-foreground",
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

      <section
        id="features"
        className="border-y-2 border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <h2
                className={cn(
                  styles.display,
                  "text-5xl font-semibold leading-[0.9] text-foreground sm:text-6xl",
                )}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

              <div
                className={cn(styles.frame, "mt-8 rounded-3xl border-2 border-border bg-card p-6")}
              >
                <div
                  className={cn(
                    styles.kicker,
                    "text-[10px] font-semibold uppercase text-muted-foreground",
                  )}
                >
                  {t(content.pain.costTitleKey)}
                </div>
                <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
                <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {content.pain.items.map((item, index) => (
                <div
                  key={item.titleKey}
                  className="rounded-3xl border-2 border-border bg-card p-6 transition hover:bg-background"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        styles.display,
                        "grid h-12 w-12 place-items-center rounded-2xl border-2 border-border bg-background text-lg font-semibold text-foreground",
                      )}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <h3 className={cn(styles.display, "text-xl font-semibold text-foreground")}>
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

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {content.useCases.items.map((item, idx) => (
              <div
                key={item.titleKey}
                className={cn(styles.frame, "rounded-3xl border-2 border-border bg-card p-6")}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className={cn(styles.display, "text-xl font-semibold text-foreground")}>
                    {t(item.titleKey)}
                  </h3>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-border bg-accent text-accent-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {t(item.bodyKey)}
                </p>
                <div
                  className={cn(
                    styles.kicker,
                    "mt-4 text-[10px] font-semibold uppercase text-muted-foreground",
                  )}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2
            className={cn(
              styles.display,
              "text-5xl font-semibold leading-[0.9] text-foreground sm:text-6xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="rounded-3xl border-2 border-border bg-card p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <div
                    className={cn(
                      styles.display,
                      "text-6xl font-semibold leading-none text-primary",
                    )}
                  >
                    {index + 1}
                  </div>
                  <div
                    className={cn(
                      styles.kicker,
                      "text-[10px] font-semibold uppercase text-muted-foreground",
                    )}
                  >
                    {t("nav.how")}
                  </div>
                </div>
                <h3 className={cn(styles.display, "mt-5 text-xl font-semibold text-foreground")}>
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

      <section className="border-y-2 border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-3xl border-2 border-border bg-card p-8">
              <h2
                className={cn(
                  styles.display,
                  "text-5xl font-semibold leading-[0.9] text-foreground sm:text-6xl",
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
                  className="group rounded-3xl border-2 border-border bg-card p-6"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t(item.questionKey)}
                      </h3>
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-border bg-secondary text-sm font-semibold text-secondary-foreground transition group-open:rotate-45">
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

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div
          className={cn(
            styles.frame,
            "mx-auto max-w-5xl rounded-[2.2rem] border-2 border-border bg-card p-8 text-center sm:p-10",
          )}
        >
          <h2
            className={cn(
              styles.display,
              "text-5xl font-semibold leading-[0.9] text-foreground sm:text-6xl",
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

      <VariantSwitcher current="16" className="border-2 border-border bg-card/90 shadow-sm" />
    </div>
  );
}
