import Link from "next/link";
import { IBM_Plex_Mono, Saira_Extra_Condensed } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-2.module.css";

const saira = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant2({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  const tapeA = t("landing.hero.guardrail");
  const tapeB = t("home.hero.trust");

  return (
    <div className={cn(styles.root, saira.variable, plexMono.variable, "min-h-screen")}>
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={`/${locale}`} className="flex items-baseline gap-3">
            <span className={cn(styles.display, "text-3xl leading-none text-foreground")}>
              WebLingo
            </span>
            <span
              className={cn(
                styles.mono,
                "hidden text-[10px] font-semibold uppercase text-muted-foreground md:inline",
              )}
            >
              {t(content.hero.taglineKey)}
            </span>
          </Link>

          <nav className={cn(styles.mono, "hidden items-center gap-6 text-xs md:flex")}>
            <Link href="#features" className="border-b-2 border-transparent hover:border-foreground">
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
            className="rounded-none border-2 border-border bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary/90"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex items-center gap-3">
              <span className={cn(styles.mono, "border-2 border-border bg-card px-3 py-2 text-[10px] font-semibold uppercase text-foreground")}>
                {t(content.hero.taglineKey)}
              </span>
              <span className="h-2 w-2 bg-primary" />
              <span className="text-xs text-muted-foreground">{t("landing.cta.startSmall")}</span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-6 text-balance text-6xl font-bold leading-[0.85] text-foreground sm:text-7xl lg:text-8xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {content.stats.map((stat) => (
                <div key={stat.valueKey} className="border-2 border-border bg-card p-4">
                  <div className={cn(styles.display, "text-4xl font-bold leading-none text-foreground")}>
                    {t(stat.valueKey)}
                  </div>
                  <div className={cn(styles.mono, "mt-2 text-[10px] font-semibold uppercase text-muted-foreground")}>
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside
            className={cn(styles.frame, styles.scanPane, styles.enter, "border-2 border-border bg-card p-6")}
            style={{ animationDelay: "110ms" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={cn(styles.mono, "inline-flex border-2 border-border bg-background px-3 py-1 text-[10px] font-semibold uppercase text-foreground")}>
                  {t("try.header.tagline")}
                </div>
                <h2 className="mt-3 text-base font-semibold text-foreground">{t("try.header.title")}</h2>
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

            <div className={cn(styles.mono, "mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-semibold uppercase text-muted-foreground")}>
              <span>{t("landing.hero.guardrail")}</span>
              <span>{t("home.hero.trust")}</span>
            </div>
          </aside>
        </div>
      </section>

      <div className="border-y-2 border-border bg-primary text-primary-foreground">
        <div className={styles.marquee}>
          <div className={cn(styles.marqueeTrack, styles.mono, "py-3 text-[11px] font-semibold uppercase")}>
            {[...Array(8)].map((_, idx) => (
              <span key={`a-${idx}`} className="px-6">
                {idx % 2 === 0 ? tapeA : tapeB}
              </span>
            ))}
            {[...Array(8)].map((_, idx) => (
              <span key={`b-${idx}`} className="px-6">
                {idx % 2 === 0 ? tapeA : tapeB}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className={cn(styles.display, "text-5xl font-bold leading-[0.9] text-foreground sm:text-6xl")}>
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className={cn(styles.frame, "mt-8 border-2 border-border bg-card p-6")}>
              <div className={cn(styles.mono, "text-[10px] font-semibold uppercase text-muted-foreground")}>
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
                className="group border-2 border-border bg-card p-6 transition hover:bg-secondary"
              >
                <div className="flex items-start gap-4">
                  <div className={cn(styles.display, "flex h-12 w-12 items-center justify-center border-2 border-border bg-background text-2xl font-bold leading-none text-foreground")}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className={cn(styles.display, "text-2xl font-bold leading-none text-foreground")}>
                        {t(item.titleKey)}
                      </h3>
                      <div className="hidden border-2 border-border bg-background p-2 text-foreground sm:block">
                        <item.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-y-2 border-border bg-secondary px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h2 className={cn(styles.display, "text-5xl font-bold leading-[0.9] text-foreground sm:text-6xl")}>
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{t(content.useCases.subtitleKey)}</p>
            </div>
            <div className="border-2 border-border bg-card p-6">
              <div className={cn(styles.mono, "text-[10px] font-semibold uppercase text-muted-foreground")}>
                {t("nav.how")}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("landing.expansion.how.risk")}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className={cn(styles.frame, "border-2 border-border bg-card p-6 transition hover:-translate-y-0.5")}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className={cn(styles.display, "text-2xl font-bold leading-none text-foreground")}>
                    {t(item.titleKey)}
                  </h3>
                  <div className="border-2 border-border bg-background p-2 text-foreground">
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className={cn(styles.display, "text-5xl font-bold leading-[0.9] text-foreground sm:text-6xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="border-2 border-border bg-card p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <div className={cn(styles.display, "text-6xl font-bold leading-none text-foreground")}>
                    {index + 1}
                  </div>
                  <div className={cn(styles.mono, "text-[10px] font-semibold uppercase text-muted-foreground")}>
                    {t("nav.how")}
                  </div>
                </div>
                <h3 className={cn(styles.display, "mt-5 text-2xl font-bold leading-none text-foreground")}>
                  {t(step.titleKey)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-border bg-secondary px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="border-2 border-border bg-card p-6">
              <h2 className={cn(styles.display, "text-5xl font-bold leading-[0.9] text-foreground sm:text-6xl")}>
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("landing.cta.risk")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <details key={item.questionKey} className="group border-2 border-border bg-card p-5 open:bg-background">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-4">
                      <span className={cn(styles.display, "text-2xl font-bold leading-none text-foreground")}>
                        {t(item.questionKey)}
                      </span>
                      <span className="mt-1 inline-flex h-7 w-7 items-center justify-center border-2 border-border bg-primary text-primary-foreground transition group-open:rotate-45">
                        +
                      </span>
                    </div>
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t(item.answerKey)}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className={cn(styles.frame, "mx-auto max-w-6xl border-2 border-border bg-card p-8 sm:p-10")}>
          <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:items-center">
            <div>
              <h2 className={cn(styles.display, "text-6xl font-bold leading-[0.85] text-foreground sm:text-7xl")}>
                {t(content.cta.titleKey)}
              </h2>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
              <div className={cn(styles.mono, "mt-4 text-[10px] font-semibold uppercase text-muted-foreground")}>
                {t("landing.cta.startSmall")}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-none border-2 border-border bg-primary px-6 text-primary-foreground shadow-none hover:bg-primary/90"
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
                className="rounded-none border-2 border-border bg-background px-6 shadow-none hover:bg-secondary"
              >
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <VariantSwitcher current="2" />
    </div>
  );
}

