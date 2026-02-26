import Link from "next/link";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-23.module.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant23({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, playfair.variable, sourceSans.variable, "min-h-screen")}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={`/${locale}`} className="inline-flex items-baseline gap-2">
            <span className={cn(styles.display, "text-2xl italic text-primary")}>W</span>
            <span className={cn(styles.body, "text-sm font-medium tracking-wide text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-8 text-sm text-muted-foreground md:flex",
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
            className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-start gap-14 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={styles.enter} style={{ animationDelay: "50ms" }}>
              <p
                className={cn(
                  styles.body,
                  "text-sm font-semibold uppercase tracking-[0.2em] text-primary",
                )}
              >
                {t(content.hero.taglineKey)}
              </p>
              <div className={cn(styles.separator, "mt-4")} />
              <h1
                className={cn(
                  styles.display,
                  "mt-6 text-5xl leading-[1.05] text-foreground sm:text-6xl lg:text-[4.2rem]",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>
              <p
                className={cn(
                  styles.body,
                  styles.dropcap,
                  "mt-8 max-w-xl text-lg leading-[1.75] text-muted-foreground",
                )}
              >
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex items-center gap-5">
                <Button
                  asChild
                  size="lg"
                  className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link href="#features">
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-primary underline underline-offset-4 hover:bg-transparent hover:text-primary/80"
                >
                  <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
                </Button>
              </div>

              <p className={cn(styles.body, "mt-6 text-xs italic text-muted-foreground")}>
                {t("landing.cta.risk")} &mdash; {t("home.hero.trust")}
              </p>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "120ms" }}>
              <div className="rounded-sm border border-border bg-card p-7 shadow-sm">
                <p
                  className={cn(
                    styles.body,
                    "text-xs font-semibold uppercase tracking-[0.2em] text-primary",
                  )}
                >
                  {t("try.header.tagline")}
                </p>
                <div className={cn(styles.separator, "mt-3")} />
                <h2 className={cn(styles.display, "mt-4 text-xl text-foreground")}>
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

          <div className="mt-16 border-t border-border pt-12">
            <div className="grid gap-10 sm:grid-cols-3">
              {content.stats.map((stat) => (
                <div key={stat.valueKey} className="text-center">
                  <p className={cn(styles.display, "text-4xl italic text-foreground")}>
                    {t(stat.valueKey)}
                  </p>
                  <div className="mx-auto mt-3 w-8 border-t border-primary/30" />
                  <p className={cn(styles.body, "mt-3 text-sm text-muted-foreground")}>
                    {t(stat.labelKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-14 lg:grid-cols-[1fr_1fr]">
            <div>
              <p
                className={cn(
                  styles.body,
                  "text-xs font-semibold uppercase tracking-[0.2em] text-primary",
                )}
              >
                {t(content.pain.costTitleKey)}
              </p>
              <div className={cn(styles.separator, "mt-3")} />
              <h2 className={cn(styles.display, "mt-5 text-3xl text-foreground sm:text-4xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-4 text-lg leading-relaxed text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>
              <blockquote className="mt-8 border-l-2 border-primary/40 pl-6">
                <p className={cn(styles.display, "text-lg italic text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-3 text-xs text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </blockquote>
            </div>

            <div className="space-y-6">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className="flex gap-5 rounded-sm border border-border bg-background p-5"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className={cn(styles.body, "font-semibold text-foreground")}>
                      {t(item.titleKey)}
                    </h3>
                    <p
                      className={cn(
                        styles.body,
                        "mt-1 text-sm leading-relaxed text-muted-foreground",
                      )}
                    >
                      {t(item.bodyKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p
            className={cn(
              styles.body,
              "text-xs font-semibold uppercase tracking-[0.2em] text-primary",
            )}
          >
            {t("nav.features")}
          </p>
          <div className={cn(styles.separator, "mx-auto mt-3")} />
          <h2 className={cn(styles.display, "mt-5 text-3xl text-foreground sm:text-4xl")}>
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mx-auto mt-4 max-w-2xl text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-12 grid gap-8 text-left md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-xl text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p
                  className={cn(styles.body, "mt-2 text-sm leading-relaxed text-muted-foreground")}
                >
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-card px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p
              className={cn(
                styles.body,
                "text-xs font-semibold uppercase tracking-[0.2em] text-primary",
              )}
            >
              {t("nav.how")}
            </p>
            <div className={cn(styles.separator, "mx-auto mt-3")} />
            <h2 className={cn(styles.display, "mt-5 text-3xl text-foreground sm:text-4xl")}>
              {t(content.how.titleKey)}
            </h2>
          </div>

          <div className="mt-14 space-y-10">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="flex gap-8">
                <div className={cn(styles.display, "text-5xl italic text-primary/25")}>
                  {index + 1}
                </div>
                <div className="border-l border-border pl-8">
                  <h3 className={cn(styles.display, "text-xl text-foreground")}>
                    {t(step.titleKey)}
                  </h3>
                  <p className={cn(styles.body, "mt-2 text-muted-foreground")}>{t(step.bodyKey)}</p>
                </div>
              </div>
            ))}
          </div>

          <p className={cn(styles.body, "mt-10 text-center text-sm italic text-muted-foreground")}>
            {t("landing.expansion.how.risk")}
          </p>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className={cn(styles.display, "text-3xl text-foreground sm:text-4xl")}>
              {t("landing.faq.title")}
            </h2>
            <div className={cn(styles.separator, "mx-auto mt-4")} />
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className="border-l-2 border-primary/20 pl-6">
                <h3 className={cn(styles.display, "text-lg text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p
                  className={cn(styles.body, "mt-2 text-sm leading-relaxed text-muted-foreground")}
                >
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className={cn(styles.display, "text-3xl italic text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-5 text-lg text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="rounded-sm border-border text-foreground hover:bg-secondary"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-sm italic text-muted-foreground")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="23" />
    </div>
  );
}
