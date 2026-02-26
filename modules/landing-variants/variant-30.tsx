import Link from "next/link";
import { Noto_Serif_Display, Zen_Kaku_Gothic_New } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-30.module.css";

const notoSerifDisplay = Noto_Serif_Display({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant30({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, notoSerifDisplay.variable, zenKaku.variable, "min-h-screen")}>
      <div aria-hidden className={styles.inkWash} />

      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
          <Link href={`/${locale}`} className="inline-flex items-baseline gap-4">
            <div className={styles.enso} />
            <span
              className={cn(
                styles.body,
                "text-xs font-medium tracking-[0.3em] text-muted-foreground",
              )}
            >
              WEBLINGO
            </span>
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-8 text-xs font-light tracking-[0.15em] text-muted-foreground md:flex",
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
            variant="ghost"
            className="text-xs font-light tracking-wider text-foreground hover:bg-foreground/5"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
        <div className={styles.hairline} />
      </header>

      <section id="try" className="px-8 pb-24 pt-24 sm:pb-32 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-start gap-20 lg:grid-cols-[1.4fr_0.6fr]">
            <div className={styles.enter} style={{ animationDelay: "100ms" }}>
              <p
                className={cn(
                  styles.body,
                  "text-xs font-light tracking-[0.3em] text-muted-foreground",
                )}
              >
                {t(content.hero.taglineKey)}
              </p>

              <h1
                className={cn(
                  styles.display,
                  "mt-10 text-5xl font-extralight leading-[1.1] text-foreground sm:text-6xl lg:text-[4.5rem]",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p
                className={cn(
                  styles.body,
                  "mt-10 max-w-lg text-base font-light leading-[2] text-muted-foreground",
                )}
              >
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-12 flex items-center gap-6">
                <Button
                  asChild
                  size="lg"
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  <Link href="#features">
                    {t(content.cta.primaryKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <a
                  href="mailto:contact@weblingo.app"
                  className={cn(
                    styles.body,
                    "text-sm font-light text-muted-foreground underline underline-offset-4 transition hover:text-foreground",
                  )}
                >
                  {t(content.cta.secondaryKey)}
                </a>
              </div>

              <p className={cn(styles.body, "mt-8 text-xs font-light text-muted-foreground/60")}>
                {t("landing.cta.risk")}
              </p>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "200ms" }}>
              <div className="border border-border bg-card p-8">
                <p
                  className={cn(
                    styles.body,
                    "text-[10px] font-light tracking-[0.3em] text-muted-foreground",
                  )}
                >
                  {t("try.header.tagline")}
                </p>
                <div className={cn(styles.hairline, "mt-4")} />
                <h2 className={cn(styles.display, "mt-5 text-xl font-light text-foreground")}>
                  {t("try.header.title")}
                </h2>
                <p className={cn(styles.body, "mt-2 text-sm font-light text-muted-foreground")}>
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

          <div className="mt-24">
            <div className={styles.hairline} />
            <div className="grid gap-16 py-16 sm:grid-cols-3">
              {content.stats.map((stat) => (
                <div key={stat.valueKey} className="text-center">
                  <p className={cn(styles.display, "text-5xl font-extralight text-foreground")}>
                    {t(stat.valueKey)}
                  </p>
                  <p
                    className={cn(
                      styles.body,
                      "mt-4 text-xs font-light tracking-[0.2em] text-muted-foreground",
                    )}
                  >
                    {t(stat.labelKey)}
                  </p>
                </div>
              ))}
            </div>
            <div className={styles.hairline} />
          </div>
        </div>
      </section>

      <section className="px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-20 lg:grid-cols-[1fr_1fr]">
            <div>
              <p
                className={cn(
                  styles.body,
                  "text-[10px] font-light tracking-[0.3em] text-muted-foreground",
                )}
              >
                {t(content.pain.costTitleKey)}
              </p>
              <h2
                className={cn(
                  styles.display,
                  "mt-6 text-3xl font-extralight text-foreground sm:text-4xl",
                )}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p className={cn(styles.body, "mt-6 font-light leading-[2] text-muted-foreground")}>
                {t(content.pain.subtitleKey)}
              </p>

              <blockquote className="mt-10 border-l border-foreground/10 pl-8">
                <p className={cn(styles.display, "text-lg font-extralight italic text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-4 text-xs font-light text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </blockquote>
            </div>

            <div className="space-y-8">
              {content.pain.items.map((item) => (
                <div key={item.titleKey} className="flex gap-6">
                  <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center text-foreground/30">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className={cn(styles.body, "text-sm font-medium text-foreground")}>
                      {t(item.titleKey)}
                    </h3>
                    <p
                      className={cn(
                        styles.body,
                        "mt-1 text-sm font-light leading-relaxed text-muted-foreground",
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

      <section id="features" className="px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className={styles.hairline} />
          <div className="py-16 text-center">
            <p
              className={cn(
                styles.body,
                "text-[10px] font-light tracking-[0.3em] text-muted-foreground",
              )}
            >
              {t("nav.features")}
            </p>
            <h2
              className={cn(
                styles.display,
                "mt-6 text-3xl font-extralight text-foreground sm:text-4xl",
              )}
            >
              {t(content.useCases.titleKey)}
            </h2>
            <p
              className={cn(styles.body, "mx-auto mt-4 max-w-xl font-light text-muted-foreground")}
            >
              {t(content.useCases.subtitleKey)}
            </p>
          </div>

          <div className="grid gap-16 md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey} className="text-center">
                <div className="mx-auto mb-6 flex h-10 w-10 items-center justify-center text-foreground/30">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className={cn(styles.display, "text-xl font-light text-foreground")}>
                  {t(item.titleKey)}
                </h3>
                <p
                  className={cn(
                    styles.body,
                    "mt-3 text-sm font-light leading-relaxed text-muted-foreground",
                  )}
                >
                  {t(item.bodyKey)}
                </p>
              </div>
            ))}
          </div>
          <div className={cn(styles.hairline, "mt-16")} />
        </div>
      </section>

      <section id="how-it-works" className="px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-3xl font-extralight text-foreground sm:text-4xl",
            )}
          >
            {t(content.how.titleKey)}
          </h2>

          <div className="mt-16 space-y-16">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="flex gap-10">
                <span className={cn(styles.display, "text-4xl font-extralight text-foreground/15")}>
                  {index + 1}
                </span>
                <div>
                  <h3 className={cn(styles.display, "text-xl font-light text-foreground")}>
                    {t(step.titleKey)}
                  </h3>
                  <p
                    className={cn(styles.body, "mt-3 font-light leading-[2] text-muted-foreground")}
                  >
                    {t(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p
            className={cn(
              styles.body,
              "mt-12 text-center text-xs font-light italic text-muted-foreground/60",
            )}
          >
            {t("landing.expansion.how.risk")}
          </p>
        </div>
      </section>

      <section className="px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className={styles.hairline} />
          <h2
            className={cn(
              styles.display,
              "mt-16 text-center text-3xl font-extralight text-foreground sm:text-4xl",
            )}
          >
            {t("landing.faq.title")}
          </h2>

          <div className="mt-14 space-y-0">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey}>
                <div className="py-8">
                  <h3 className={cn(styles.display, "text-lg font-light text-foreground")}>
                    {t(item.questionKey)}
                  </h3>
                  <p
                    className={cn(
                      styles.body,
                      "mt-3 text-sm font-light leading-relaxed text-muted-foreground",
                    )}
                  >
                    {t(item.answerKey)}
                  </p>
                </div>
                <div className={styles.hairline} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className={cn(
              styles.display,
              "text-4xl font-extralight italic text-foreground sm:text-5xl",
            )}
          >
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-6 font-light text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-5 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Link href="#try">
                {t(content.cta.primaryKey)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-foreground underline underline-offset-4 hover:bg-transparent hover:text-foreground/70"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-8 text-xs font-light text-muted-foreground/50")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="30" />
    </div>
  );
}
