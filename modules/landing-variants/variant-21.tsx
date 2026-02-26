import Link from "next/link";
import { Instrument_Serif, DM_Sans } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-21.module.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant21({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, instrumentSerif.variable, dmSans.variable, "min-h-screen")}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href={`/${locale}`} className="inline-flex items-center gap-4">
            <span className="h-8 w-8 bg-foreground" />
            <span className={cn(styles.body, "text-sm font-semibold uppercase tracking-[0.2em]")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground md:flex",
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
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-start gap-16 lg:grid-cols-[1.3fr_0.7fr]">
            <div className={styles.enter} style={{ animationDelay: "60ms" }}>
              <div className={styles.redBar} />
              <h1
                className={cn(
                  styles.display,
                  "mt-8 text-6xl leading-[0.92] text-foreground sm:text-7xl lg:text-[5.5rem]",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>
              <p
                className={cn(
                  styles.body,
                  "mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground",
                )}
              >
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                  className="border-foreground text-foreground hover:bg-foreground hover:text-background"
                >
                  <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
                </Button>
              </div>

              <div className="mt-8 flex gap-3 text-xs text-muted-foreground">
                <span>{t("landing.cta.risk")}</span>
                <span className="text-border">|</span>
                <span>{t("home.hero.trust")}</span>
              </div>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "140ms" }}>
              <div className="border border-border bg-card p-8">
                <div className={styles.label}>{t("try.header.tagline")}</div>
                <h2 className={cn(styles.display, "mt-4 text-2xl text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                  {t("try.header.description")}
                </p>
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

          <div className="mt-20 grid gap-px border border-border bg-border sm:grid-cols-3">
            {content.stats.map((stat, idx) => (
              <div
                key={stat.valueKey}
                className={cn(styles.enterStagger, "bg-card px-8 py-8")}
                style={{ animationDelay: `${240 + idx * 100}ms` }}
              >
                <p className={cn(styles.display, "text-5xl text-foreground")}>{t(stat.valueKey)}</p>
                <p className={cn(styles.label, "mt-3 text-muted-foreground")}>{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <div className={styles.redBar} />
              <h2 className={cn(styles.display, "mt-6 text-4xl text-foreground sm:text-5xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-6 text-lg text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <div className="mt-10 border-l-4 border-primary bg-primary/5 p-6">
                <div className={styles.label}>{t(content.pain.costTitleKey)}</div>
                <p className={cn(styles.body, "mt-3 text-base text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-2 text-xs text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </div>
            </div>

            <div className="grid gap-0 border border-border bg-border">
              {content.pain.items.map((item) => (
                <div key={item.titleKey} className="flex gap-5 bg-card p-6">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-foreground text-background">
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
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className={styles.redBar} />
          <h2 className={cn(styles.display, "mt-6 text-4xl text-foreground sm:text-5xl")}>
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-4 max-w-2xl text-lg text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-14 grid gap-px border border-border bg-border md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className="bg-card p-8 transition hover:bg-secondary/50">
                <div className="mb-5 flex h-10 w-10 items-center justify-center bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.body, "text-lg font-semibold text-foreground")}>
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

      <section id="how-it-works" className="border-y border-border px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto w-fit">
            <div className={styles.redBar} />
          </div>
          <h2
            className={cn(styles.display, "mt-6 text-center text-4xl text-foreground sm:text-5xl")}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-16 space-y-0">
            {content.how.items.map((step, index) => (
              <div
                key={step.titleKey}
                className="grid border-b border-border py-8 sm:grid-cols-[100px_1fr] sm:items-start"
              >
                <div className={cn(styles.display, "text-6xl text-primary/30")}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className={cn(styles.body, "text-xl font-semibold text-foreground")}>
                    {t(step.titleKey)}
                  </h3>
                  <p className={cn(styles.body, "mt-2 text-muted-foreground")}>{t(step.bodyKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className={styles.redBar} />
          <h2 className={cn(styles.display, "mt-6 text-4xl text-foreground sm:text-5xl")}>
            {t("landing.faq.title")}
          </h2>

          <div className="mt-14 grid gap-px border border-border bg-border md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className="bg-card p-8">
                <h3 className={cn(styles.body, "font-semibold text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p className={cn(styles.body, "mt-3 text-sm text-muted-foreground")}>
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-foreground px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-4xl text-background sm:text-5xl lg:text-6xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-6 text-lg text-background/60")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="border-background/30 text-background hover:bg-background/10"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-sm text-background/40")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="21" />
    </div>
  );
}
