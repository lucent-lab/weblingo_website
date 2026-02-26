import Link from "next/link";
import { Fira_Code, Space_Mono } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-24.module.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant24({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, firaCode.variable, spaceMono.variable, "min-h-screen")}>
      <div aria-hidden className={styles.scanlines} />
      <div aria-hidden className={styles.crt} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className={cn(styles.mono, styles.glowText, "text-sm font-bold text-primary")}>
              [weblingo]
            </span>
            <span className={cn(styles.blink, "inline-block h-4 w-2 bg-primary")} />
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-6 text-xs text-muted-foreground md:flex",
            )}
          >
            <Link href="#features" className="transition hover:text-primary">
              /{t("nav.features")}
            </Link>
            <Link href="#how-it-works" className="transition hover:text-primary">
              /{t("nav.how")}
            </Link>
            <Link href={`/${locale}/pricing`} className="transition hover:text-primary">
              /{t("nav.pricing")}
            </Link>
          </nav>

          <Button
            asChild
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="#try" className={styles.mono}>
              {t("nav.try")}
            </Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className={styles.enter} style={{ animationDelay: "50ms" }}>
              <div className={cn(styles.body, "text-xs text-muted-foreground")}>
                <span className="text-primary">$</span> weblingo --describe
              </div>

              <div
                className={cn(
                  styles.mono,
                  "mt-3 inline-block border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary",
                )}
              >
                {t(content.hero.taglineKey)}
              </div>

              <h1
                className={cn(
                  styles.mono,
                  styles.glowText,
                  "mt-6 text-4xl font-bold leading-tight text-foreground sm:text-5xl",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p
                className={cn(
                  styles.body,
                  "mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground",
                )}
              >
                <span className="text-primary">{"//"} </span>
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link href="#features" className={styles.mono}>
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-border text-foreground hover:bg-secondary"
                >
                  <a href="mailto:contact@weblingo.app" className={styles.mono}>
                    {t(content.cta.secondaryKey)}
                  </a>
                </Button>
              </div>

              <div className={cn(styles.body, "mt-6 text-xs text-muted-foreground")}>
                <span className="text-primary">{"//"} </span>
                {t("landing.cta.risk")}
              </div>
              <div className={cn(styles.body, "mt-1 text-xs text-muted-foreground")}>
                <span className="text-primary">{"//"} </span>
                {t("home.hero.trust")}
              </div>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "120ms" }}>
              <div className={cn(styles.borderGlow, "bg-card p-6")}>
                <div className={cn(styles.body, "text-[10px] text-muted-foreground")}>
                  <span className="text-primary">$</span> weblingo preview --init
                </div>
                <div className="mt-1 h-px bg-border" />
                <div className={cn(styles.mono, "mt-4 text-xs font-bold text-primary")}>
                  {t("try.header.tagline")}
                </div>
                <h2 className={cn(styles.mono, "mt-2 text-lg font-bold text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-1 text-xs text-muted-foreground")}>
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

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div key={stat.valueKey} className={cn(styles.borderGlow, "bg-card px-5 py-5")}>
                <p className={cn(styles.mono, styles.glowText, "text-3xl font-bold text-primary")}>
                  {t(stat.valueKey)}
                </p>
                <p
                  className={cn(
                    styles.body,
                    "mt-2 text-[10px] uppercase tracking-widest text-muted-foreground",
                  )}
                >
                  {t(stat.labelKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <div className={cn(styles.body, "text-xs text-muted-foreground")}>
                <span className="text-primary">$</span> weblingo diagnose --pain-points
              </div>
              <h2
                className={cn(
                  styles.mono,
                  styles.glowText,
                  "mt-4 text-3xl font-bold text-foreground sm:text-4xl",
                )}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-4 text-sm text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <div className={cn(styles.borderGlow, "mt-8 bg-card p-5")}>
                <div className={cn(styles.mono, "text-xs font-bold text-primary")}>
                  {t(content.pain.costTitleKey)}
                </div>
                <p className={cn(styles.body, "mt-2 text-sm text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-2 text-[10px] text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {content.pain.items.map((item, idx) => (
                <div key={item.titleKey} className={cn(styles.borderGlow, "bg-card p-5")}>
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-9 w-9 place-items-center border border-primary/30 bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className={cn(styles.body, "text-[10px] text-muted-foreground")}>
                        [{String(idx + 1).padStart(2, "0")}]
                      </div>
                      <h3 className={cn(styles.mono, "text-sm font-bold text-foreground")}>
                        {t(item.titleKey)}
                      </h3>
                      <p className={cn(styles.body, "mt-1 text-xs text-muted-foreground")}>
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
        <div className="mx-auto max-w-5xl">
          <div className={cn(styles.body, "text-xs text-muted-foreground")}>
            <span className="text-primary">$</span> weblingo features --list
          </div>
          <h2
            className={cn(
              styles.mono,
              styles.glowText,
              "mt-4 text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-3 max-w-2xl text-sm text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(styles.borderGlow, "bg-card p-5 transition hover:border-primary/30")}
              >
                <div className="mb-3 grid h-10 w-10 place-items-center border border-primary/20 bg-primary/5 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <h3 className={cn(styles.mono, "text-sm font-bold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-xs text-muted-foreground")}>
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className={cn(styles.body, "text-xs text-muted-foreground")}>
              <span className="text-primary">$</span> weblingo --help
            </div>
            <h2
              className={cn(
                styles.mono,
                styles.glowText,
                "mt-4 text-3xl font-bold text-foreground sm:text-4xl",
              )}
            >
              {t(content.how.titleKey)}
            </h2>
          </div>

          <div className="mt-12 space-y-1">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.borderGlow, "bg-card p-5")}>
                <div className="flex items-start gap-5">
                  <div
                    className={cn(
                      styles.mono,
                      styles.glowText,
                      "w-8 text-right text-2xl font-bold text-primary",
                    )}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h3 className={cn(styles.mono, "text-sm font-bold text-foreground")}>
                      {t(step.titleKey)}
                    </h3>
                    <p className={cn(styles.body, "mt-1 text-xs text-muted-foreground")}>
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
              styles.mono,
              styles.glowText,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t("landing.faq.title")}
          </h2>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className={cn(styles.borderGlow, "bg-card p-5")}>
                <h3 className={cn(styles.mono, "text-sm font-bold text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-xs text-muted-foreground")}>
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className={cn(styles.body, "text-xs text-muted-foreground")}>
            <span className="text-primary">$</span> weblingo start
          </div>
          <h2
            className={cn(
              styles.mono,
              styles.glowText,
              "mt-4 text-3xl font-bold text-foreground sm:text-5xl",
            )}
          >
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-4 text-sm text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="#try" className={styles.mono}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border text-foreground hover:bg-secondary"
            >
              <a href="mailto:contact@weblingo.app" className={styles.mono}>
                {t(content.cta.secondaryKey)}
              </a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-xs text-muted-foreground")}>
            <span className="text-primary">{"//"} </span>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="24" className="border-border bg-card/80 text-foreground" />
    </div>
  );
}
