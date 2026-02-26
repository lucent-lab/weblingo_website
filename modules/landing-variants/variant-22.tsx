import Link from "next/link";
import { Sora, JetBrains_Mono } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-22.module.css";

const sora = Sora({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-mono",
});

export function LandingVariant22({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, sora.variable, jetbrainsMono.variable, "min-h-screen")}>
      <div aria-hidden className={styles.aurora} />
      <div aria-hidden className={styles.stars} />

      <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div
          className={cn(
            styles.glassPanel,
            "mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-2xl px-5 py-3",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span
              className={cn(
                styles.glowRing,
                "grid h-8 w-8 place-items-center rounded-full bg-primary/10",
              )}
            >
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(45,212,191,0.6)]" />
            </span>
            <span className={cn(styles.display, "text-sm font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav
            className={cn(
              styles.mono,
              "hidden items-center gap-6 text-[10px] uppercase text-muted-foreground md:flex",
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
            className="rounded-full bg-primary/20 text-primary shadow-[0_0_20px_rgba(45,212,191,0.15)] hover:bg-primary/30"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
        <div className="mx-auto max-w-5xl">
          <div className={cn(styles.enter, "text-center")} style={{ animationDelay: "40ms" }}>
            <div
              className={cn(
                styles.mono,
                "inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[10px] uppercase text-primary",
              )}
            >
              <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
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

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_rgba(45,212,191,0.2)] hover:bg-primary/90 hover:shadow-[0_0_60px_rgba(45,212,191,0.3)]"
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
                className="rounded-full border-foreground/20 text-foreground hover:bg-foreground/5"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className={cn(styles.mono, "mt-6 text-[10px] uppercase text-muted-foreground")}>
              {t("landing.cta.risk")} &middot; {t("home.hero.trust")}
            </div>
          </div>

          <div
            className={cn(
              styles.enter,
              styles.glassPanel,
              "mx-auto mt-14 max-w-3xl rounded-3xl p-6",
            )}
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className={cn(styles.mono, "text-[10px] uppercase text-primary")}>
                  {t("try.header.tagline")}
                </div>
                <h2 className={cn(styles.display, "mt-2 text-lg font-semibold text-foreground")}>
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

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.valueKey}
                className={cn(styles.glassPanel, "rounded-2xl px-6 py-5 text-center")}
              >
                <p className={cn(styles.display, "text-3xl font-bold text-primary")}>
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

      <section className="border-y border-border/50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className={cn(styles.display, "text-3xl font-bold text-foreground sm:text-4xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className="mt-4 text-muted-foreground">{t(content.pain.subtitleKey)}</p>

              <div className={cn(styles.glassPanel, "mt-8 rounded-2xl p-6")}>
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
                  className={cn(
                    styles.glassPanel,
                    "group rounded-2xl p-5 transition hover:border-primary/20",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        styles.glowRing,
                        "mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:shadow-[0_0_20px_rgba(45,212,191,0.2)]",
                      )}
                    >
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
        <div className="mx-auto max-w-5xl">
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

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(
                  styles.glassPanel,
                  "group rounded-2xl p-6 transition hover:border-accent/30",
                )}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border/50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-bold text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-12 space-y-6">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className={cn(styles.glassPanel, "rounded-2xl p-6")}>
                <div className="flex items-start gap-5">
                  <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_30px_rgba(45,212,191,0.15)]">
                    <span className={cn(styles.display, "text-lg font-bold")}>{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
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
              <div key={item.questionKey} className={cn(styles.glassPanel, "rounded-2xl p-6")}>
                <h3 className="font-semibold text-foreground">{t(item.questionKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.answerKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className={cn(styles.display, "text-4xl font-bold text-foreground sm:text-5xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_rgba(45,212,191,0.2)] hover:bg-primary/90"
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
              className="rounded-full border-foreground/20 text-foreground hover:bg-foreground/5"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t("landing.cta.startSmall")}</p>
        </div>
      </section>

      <VariantSwitcher current="22" className="border-border/50 bg-background/40 backdrop-blur" />
    </div>
  );
}
