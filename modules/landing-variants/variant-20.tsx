import Link from "next/link";
import { Bricolage_Grotesque, Karla } from "next/font/google";
import { ArrowRight, BarChart3, Cloud, Sparkles } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-20.module.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const karla = Karla({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

const featureItems = [
  {
    titleKey: "home.features.ai.title",
    descriptionKey: "home.features.ai.description",
    icon: Sparkles,
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

export function LandingVariant20({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, bricolage.variable, karla.variable, "min-h-screen font-sans")}>
      <div aria-hidden className={styles.glow} />
      <div aria-hidden className={styles.noise} />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div
          className={cn(
            styles.panel,
            "mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 backdrop-blur",
          )}
        >
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 shadow-[0_0_0_1px_rgba(132,204,22,0.20)]">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(132,204,22,0.34)]" />
            </span>
            <span className={cn(styles.display, "text-base font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground md:flex">
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

          <Button
            asChild
            size="sm"
            className="rounded-full bg-primary px-4 text-primary-foreground shadow-[0_0_0_1px_rgba(132,204,22,0.18),0_18px_70px_rgba(0,0,0,0.45)] hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <div
            className={cn(styles.enter, "mx-auto max-w-4xl text-center")}
            style={{ animationDelay: "40ms" }}
          >
            <div className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/90">
              {t(content.hero.taglineKey)}
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-5xl font-semibold leading-[0.9] text-foreground sm:text-6xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-8 text-primary-foreground shadow-[0_0_0_1px_rgba(132,204,22,0.22),0_22px_80px_rgba(132,204,22,0.08)] hover:bg-primary/90"
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
                className="rounded-full border-white/20 bg-transparent px-8 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-white/5"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-2 text-sm text-muted-foreground">
              <p>{t("landing.cta.risk")}</p>
              <p>{t("home.hero.trust")}</p>
            </div>
          </div>

          <div
            className={cn(
              styles.enter,
              styles.panel,
              "mx-auto mt-12 max-w-4xl rounded-3xl p-6 backdrop-blur",
            )}
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
                  {t("try.header.tagline")}
                </div>
                <h2 className={cn(styles.display, "mt-3 text-xl font-semibold text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
              </div>
              <div className="text-sm text-muted-foreground">{t("landing.cta.startSmall")}</div>
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

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div key={stat.valueKey} className={cn(styles.panel, "rounded-3xl px-6 py-6")}>
                <div
                  className={cn(
                    styles.display,
                    "text-3xl font-semibold leading-none text-foreground",
                  )}
                >
                  {t(stat.valueKey)}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  {t(stat.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="features"
        className="border-y border-white/10 bg-secondary/25 px-4 py-16 sm:px-6 sm:py-24"
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

              <div className={cn(styles.panel, "mt-8 rounded-3xl p-6")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                  {t(content.pain.costTitleKey)}
                </div>
                <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
                <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
              </div>
            </div>

            <div className="grid gap-4">
              {featureItems.map((item) => (
                <div key={item.titleKey} className={cn(styles.panel, "rounded-3xl p-6")}>
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(132,204,22,0.16)]">
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
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {content.pain.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.panel, "rounded-3xl p-6")}>
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent shadow-[0_0_0_1px_rgba(14,116,144,0.16)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
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

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className={cn(styles.panel, "rounded-3xl p-6")}>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-lg font-semibold text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.bodyKey)}
                </p>
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
              <div key={step.titleKey} className={cn(styles.panel, "rounded-3xl p-6")}>
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_60px_rgba(132,204,22,0.12)]">
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
        </div>
      </section>

      <section
        id="faq"
        className="border-t border-white/10 bg-secondary/20 px-4 py-16 sm:px-6 sm:py-24"
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
              <div key={item.questionKey} className={cn(styles.panel, "rounded-3xl p-6")}>
                <div className="text-base font-semibold text-foreground">{t(item.questionKey)}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(item.answerKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <VariantSwitcher current="20" className="border-white/10 bg-black/30 text-foreground" />
    </div>
  );
}
