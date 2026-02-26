import Link from "next/link";
import { Archivo_Black, Work_Sans } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-25.module.css";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-display",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant25({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, archivoBlack.variable, workSans.variable, "min-h-screen")}>
      <div aria-hidden className={styles.geo} />

      <header className="sticky top-0 z-40 border-b-3 border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={`/${locale}`} className="inline-flex items-center gap-3">
            <span className={cn(styles.redBlock, "grid h-8 w-8 place-items-center")}>
              <span className="text-xs font-bold">W</span>
            </span>
            <span className={cn(styles.display, "text-sm text-foreground")}>WebLingo</span>
          </Link>

          <nav
            className={cn(styles.label, "hidden items-center gap-8 text-muted-foreground md:flex")}
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
            className={cn(
              styles.thickBorder,
              "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-6 pb-16 pt-14 sm:pb-28 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-12 lg:grid-cols-[1.3fr_0.7fr]">
            <div className={styles.enter} style={{ animationDelay: "50ms" }}>
              <div className={cn(styles.yellowBlock, "inline-block px-4 py-2")}>
                <span className={styles.label}>{t(content.hero.taglineKey)}</span>
              </div>

              <h1
                className={cn(
                  styles.display,
                  "mt-8 text-5xl leading-[0.9] text-foreground sm:text-6xl lg:text-8xl",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p className={cn(styles.body, "mt-8 max-w-xl text-lg text-muted-foreground")}>
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex gap-4">
                <Button
                  asChild
                  size="lg"
                  className={cn(
                    styles.thickBorder,
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  <Link href="#features">
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className={cn(styles.thickBorder, styles.blueBlock, "hover:opacity-90")}
                >
                  <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
                </Button>
              </div>

              <p className={cn(styles.body, "mt-6 text-xs text-muted-foreground")}>
                {t("landing.cta.risk")} / {t("home.hero.trust")}
              </p>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "120ms" }}>
              <div className={cn(styles.thickBorder, "bg-card p-6")}>
                <div className={cn(styles.blueBlock, "inline-block px-3 py-1")}>
                  <span className={cn(styles.label, "text-white")}>{t("try.header.tagline")}</span>
                </div>
                <h2 className={cn(styles.display, "mt-4 text-xl text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
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

          <div className="mt-16 grid gap-3 sm:grid-cols-3">
            {content.stats.map((stat, idx) => {
              const blocks = [styles.redBlock, styles.blueBlock, styles.yellowBlock];
              return (
                <div key={stat.valueKey} className={cn(styles.thickBorder, "bg-card p-6")}>
                  <div className={cn(blocks[idx % blocks.length], "mb-4 inline-block h-3 w-12")} />
                  <p className={cn(styles.display, "text-4xl text-foreground")}>
                    {t(stat.valueKey)}
                  </p>
                  <p className={cn(styles.label, "mt-2 text-muted-foreground")}>
                    {t(stat.labelKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y-3 border-border bg-card px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <div className={cn(styles.redBlock, "inline-block h-3 w-16")} />
              <h2 className={cn(styles.display, "mt-6 text-4xl text-foreground sm:text-5xl")}>
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-4 text-lg text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <div className={cn(styles.thickBorder, styles.yellowBlock, "mt-8 p-6")}>
                <div className={styles.label}>{t(content.pain.costTitleKey)}</div>
                <p className={cn(styles.body, "mt-3 text-base font-medium")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-2 text-xs opacity-70")}>
                  {t("landing.cost.stat")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className={cn(
                    styles.thickBorder,
                    "bg-card p-5 transition hover:-translate-y-0.5",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        styles.blueBlock,
                        "grid h-10 w-10 flex-shrink-0 place-items-center",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn(styles.body, "font-bold text-foreground")}>
                        {t(item.titleKey)}
                      </h3>
                      <p className={cn(styles.body, "mt-1 text-sm text-muted-foreground")}>
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

      <section id="features" className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className={cn(styles.blueBlock, "inline-block h-3 w-16")} />
          <h2 className={cn(styles.display, "mt-6 text-4xl text-foreground sm:text-5xl")}>
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-4 max-w-2xl text-lg text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {content.useCases.items.map((item, idx) => {
              const accents = ["border-l-primary", "border-l-accent", "border-l-[hsl(52,92%,52%)]"];
              return (
                <div
                  key={item.titleKey}
                  className={cn(
                    styles.thickBorder,
                    `border-l-[6px] ${accents[idx % accents.length]}`,
                    "bg-card p-6",
                  )}
                >
                  <div className="mb-4 grid h-10 w-10 place-items-center bg-secondary text-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className={cn(styles.display, "text-base text-foreground")}>
                    {t(item.titleKey)}
                  </h3>
                  <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                    {t(item.bodyKey)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y-3 border-border bg-card px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className={cn(styles.display, "text-center text-4xl text-foreground sm:text-5xl")}>
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-14 grid gap-3 md:grid-cols-3">
            {content.how.items.map((step, index) => {
              const blocks = [styles.redBlock, styles.blueBlock, styles.yellowBlock];
              return (
                <div key={step.titleKey} className={cn(styles.thickBorder, "bg-background p-6")}>
                  <div
                    className={cn(
                      blocks[index % blocks.length],
                      "mb-4 grid h-14 w-14 place-items-center",
                    )}
                  >
                    <span className={cn(styles.display, "text-2xl")}>{index + 1}</span>
                  </div>
                  <h3 className={cn(styles.display, "text-base text-foreground")}>
                    {t(step.titleKey)}
                  </h3>
                  <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                    {t(step.bodyKey)}
                  </p>
                </div>
              );
            })}
          </div>

          <p className={cn(styles.body, "mt-10 text-center text-sm text-muted-foreground")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className={cn(styles.display, "text-4xl text-foreground sm:text-5xl")}>
            {t("landing.faq.title")}
          </h2>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className={cn(styles.thickBorder, "bg-card p-6")}>
                <h3 className={cn(styles.body, "font-bold text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p className={cn(styles.body, "mt-2 text-sm text-muted-foreground")}>
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t-3 border-border bg-foreground px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className={cn(styles.display, "text-4xl text-background sm:text-6xl")}>
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-5 text-lg text-background/60")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className={cn(styles.redBlock, "border-3 border-background/20 hover:opacity-90")}
            >
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className={cn(styles.yellowBlock, "border-3 border-background/20 hover:opacity-90")}
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-sm text-background/40")}>
            {t("landing.cta.startSmall")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="25" className="border-3 border-border bg-card" />
    </div>
  );
}
