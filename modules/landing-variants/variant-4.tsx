import Link from "next/link";
import { Alegreya_Sans, Cormorant_Garamond } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-4.module.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-sans",
});

function WaveDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative -mt-1 h-10 w-full overflow-hidden", className)}>
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="h-full w-full text-secondary/70"
      >
        <path
          fill="currentColor"
          d="M0,64 C120,96 240,112 360,96 C480,80 600,32 720,32 C840,32 960,80 1080,96 C1200,112 1320,96 1440,64 L1440,120 L0,120 Z"
        />
      </svg>
    </div>
  );
}

export function LandingVariant4({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, cormorant.variable, alegreyaSans.variable, "min-h-screen")}>
      <div aria-hidden className={styles.topo} />

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-border bg-background/70 px-4 py-3 shadow-sm backdrop-blur">
          <Link href={`/${locale}`} className="group inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition group-hover:-rotate-3">
              <span className="h-2 w-2 rounded-full bg-primary-foreground/90" />
            </span>
            <span className={cn(styles.display, "text-xl font-semibold text-foreground")}>
              WebLingo
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
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

          <Button asChild size="sm" className="rounded-full">
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="relative px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-16">
        <div aria-hidden className={styles.blobA} />
        <div aria-hidden className={styles.blobB} />

        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
          <div className={cn(styles.enter)} style={{ animationDelay: "40ms" }}>
            <div className="inline-flex items-center gap-3">
              <span className="rounded-full border border-border bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground shadow-sm">
                {t(content.hero.taglineKey)}
              </span>
              <span className="hidden h-px w-16 bg-border sm:block" />
              <span className="hidden text-xs text-muted-foreground sm:block">{t("home.hero.trust")}</span>
            </div>

            <h1
              className={cn(
                styles.display,
                "mt-7 text-balance text-6xl font-semibold leading-[0.9] text-foreground sm:text-7xl lg:text-7xl",
              )}
            >
              {t(content.hero.titleKey)}
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t(content.hero.subtitleKey)}
            </p>

            <div className="mt-8 grid max-w-xl gap-2 text-sm text-muted-foreground">
              <p>{t("landing.hero.guardrail")}</p>
              <p>{t("landing.cta.startSmall")}</p>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="rounded-full">
                <Link href="#features">
                  {t(content.cta.primaryKey)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
              </Button>
            </div>
          </div>

          <aside className={cn(styles.enter)} style={{ animationDelay: "120ms" }}>
            <div className="rounded-[1.8rem] border border-border bg-card/90 p-6 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                    {t("try.header.tagline")}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">{t("try.header.title")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("try.header.description")}</p>
                </div>
                <div className="hidden rounded-2xl border border-border bg-background px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:block">
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
          </aside>
        </div>

        <div className="mx-auto mt-14 max-w-6xl">
          <div className="grid gap-6 sm:grid-cols-3">
            {content.stats.map((stat, idx) => (
              <div
                key={stat.valueKey}
                className={cn(
                  "rounded-[1.25rem] border border-border bg-card/70 px-6 py-6 shadow-sm",
                  styles.enter,
                )}
                style={{ animationDelay: `${210 + idx * 90}ms` }}
              >
                <p className={cn(styles.display, "text-4xl font-semibold text-foreground")}>
                  {t(stat.valueKey)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider />

      <section className="bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <h2 className={cn(styles.display, "text-4xl font-semibold text-foreground sm:text-5xl")}>
              {t(content.pain.titleKey)}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>

            <div className="mt-8 rounded-[1.75rem] border border-primary/20 bg-primary/10 p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/80">
                {t(content.pain.costTitleKey)}
              </p>
              <p className="mt-3 text-base text-foreground">{t(content.pain.costBodyKey)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("landing.cost.stat")}</p>
            </div>
          </div>

          <div className="grid gap-6">
            {content.pain.items.map((item) => (
              <div
                key={item.titleKey}
                className="group rounded-[1.75rem] border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-sm transition group-hover:-rotate-2">
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

      <WaveDivider className="rotate-180" />

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h2 className={cn(styles.display, "text-4xl font-semibold text-foreground sm:text-5xl")}>
                {t(content.useCases.titleKey)}
              </h2>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
                {t(content.useCases.subtitleKey)}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {t("nav.how")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("landing.expansion.how.risk")}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div
                key={item.titleKey}
                className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className={cn(styles.display, "text-center text-4xl font-semibold text-foreground sm:text-5xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="grid gap-6">
              {content.how.items.map((step, index) => (
                <div key={step.titleKey} className="relative rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
                  <div className="flex gap-5">
                    <div className="relative">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                        <span className="text-base font-semibold">{index + 1}</span>
                      </div>
                      {index < content.how.items.length - 1 ? (
                        <div aria-hidden className="absolute left-1/2 top-12 h-[calc(100%+24px)] w-px -translate-x-1/2 border-l border-dashed border-border" />
                      ) : null}
                    </div>
                    <div className="pt-1">
                      <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.bodyKey)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-sm text-muted-foreground">{t("landing.cta.risk")}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="rounded-[1.75rem] border border-border bg-card p-8 shadow-sm">
              <h2 className={cn(styles.display, "text-4xl font-semibold text-foreground sm:text-5xl")}>
                {t("landing.faq.title")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("landing.hero.guardrail")}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {LANDING_FAQ_ITEMS.map((item) => (
                <div key={item.questionKey} className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-foreground">{t(item.questionKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(item.answerKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WaveDivider />

      <section className="bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-4xl font-semibold text-foreground sm:text-6xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
          </div>
        </div>
      </section>

      <VariantSwitcher current="4" />
    </div>
  );
}

