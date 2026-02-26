import Link from "next/link";
import { Cormorant_Garamond, Libre_Franklin } from "next/font/google";
import { ArrowRight } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-26.module.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

export function LandingVariant26({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  return (
    <div className={cn(styles.root, cormorant.variable, libreFranklin.variable, "min-h-screen")}>
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href={`/${locale}`} className="inline-flex items-baseline gap-3">
            <span className={cn(styles.display, "text-2xl font-light italic text-primary")}>W</span>
            <span className={styles.goldLine} />
            <span className={cn(styles.label)}>WebLingo</span>
          </Link>

          <nav
            className={cn(
              styles.body,
              "hidden items-center gap-8 text-xs font-light tracking-wider text-muted-foreground md:flex",
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
            className="border border-primary/30 bg-transparent text-primary hover:bg-primary/10"
          >
            <Link href="#try">{t("nav.try")}</Link>
          </Button>
        </div>
      </header>

      <section id="try" className="px-6 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-start gap-16 lg:grid-cols-[1.25fr_0.75fr]">
            <div className={styles.enter} style={{ animationDelay: "60ms" }}>
              <div className={styles.label}>{t(content.hero.taglineKey)}</div>
              <div className={cn(styles.goldLine, "mt-5")} />

              <h1
                className={cn(
                  styles.display,
                  "mt-8 text-5xl font-light leading-[1.05] text-foreground sm:text-6xl lg:text-7xl",
                )}
              >
                {t(content.hero.titleKey)}
              </h1>

              <p
                className={cn(
                  styles.body,
                  "mt-8 max-w-xl text-base font-light leading-[1.8] text-muted-foreground",
                )}
              >
                {t(content.hero.subtitleKey)}
              </p>

              <div className="mt-10 flex items-center gap-6">
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
                <a
                  href="mailto:contact@weblingo.app"
                  className={cn(
                    styles.body,
                    "text-sm font-light text-primary underline underline-offset-4 transition hover:text-primary/70",
                  )}
                >
                  {t(content.cta.secondaryKey)}
                </a>
              </div>

              <div
                className={cn(
                  styles.body,
                  "mt-8 text-xs font-light tracking-wide text-muted-foreground/60",
                )}
              >
                {t("landing.cta.risk")} &middot; {t("home.hero.trust")}
              </div>
            </div>

            <aside className={styles.enter} style={{ animationDelay: "140ms" }}>
              <div className={cn(styles.luxPanel, "p-7")}>
                <div className={styles.label}>{t("try.header.tagline")}</div>
                <div className={cn(styles.goldLine, "mt-4")} />
                <h2 className={cn(styles.display, "mt-5 text-2xl font-light text-foreground")}>
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

          <div className="mt-20 grid gap-8 border-t border-border/50 pt-12 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div key={stat.valueKey} className="text-center">
                <p className={cn(styles.display, "text-5xl font-light text-primary")}>
                  {t(stat.valueKey)}
                </p>
                <div className={cn(styles.goldLine, "mx-auto mt-4")} />
                <p className={cn(styles.label, "mt-4")}>{t(stat.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <div className={styles.label}>{t(content.pain.costTitleKey)}</div>
              <div className={cn(styles.goldLine, "mt-4")} />
              <h2
                className={cn(
                  styles.display,
                  "mt-6 text-4xl font-light text-foreground sm:text-5xl",
                )}
              >
                {t(content.pain.titleKey)}
              </h2>
              <p
                className={cn(styles.body, "mt-5 font-light leading-relaxed text-muted-foreground")}
              >
                {t(content.pain.subtitleKey)}
              </p>

              <blockquote className="mt-10 border-l border-primary/40 pl-6">
                <p className={cn(styles.display, "text-xl font-light italic text-foreground")}>
                  {t(content.pain.costBodyKey)}
                </p>
                <p className={cn(styles.body, "mt-3 text-xs font-light text-muted-foreground")}>
                  {t("landing.cost.stat")}
                </p>
              </blockquote>
            </div>

            <div className="space-y-4">
              {content.pain.items.map((item) => (
                <div
                  key={item.titleKey}
                  className={cn(styles.luxPanel, "p-6 transition hover:border-primary/20")}
                >
                  <div className="flex items-start gap-5">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center border border-primary/20 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn(styles.body, "text-sm font-medium text-foreground")}>
                        {t(item.titleKey)}
                      </h3>
                      <p
                        className={cn(styles.body, "mt-1 text-xs font-light text-muted-foreground")}
                      >
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

      <section id="features" className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl text-center">
          <div className={styles.label}>{t("nav.features")}</div>
          <div className={cn(styles.goldLine, "mx-auto mt-4")} />
          <h2
            className={cn(styles.display, "mt-6 text-4xl font-light text-foreground sm:text-5xl")}
          >
            {t(content.useCases.titleKey)}
          </h2>
          <p className={cn(styles.body, "mx-auto mt-4 max-w-2xl font-light text-muted-foreground")}>
            {t(content.useCases.subtitleKey)}
          </p>

          <div className="mt-14 grid gap-8 text-left md:grid-cols-3">
            {content.useCases.items.map((item) => (
              <div key={item.titleKey}>
                <div className="mb-5 grid h-10 w-10 place-items-center border border-primary/20 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <h3 className={cn(styles.display, "text-2xl font-light text-foreground")}>
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
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className={cn(styles.display, "text-4xl font-light text-foreground sm:text-5xl")}>
              {t(content.how.titleKey)}
            </h2>
            <div className={cn(styles.goldLine, "mx-auto mt-5")} />
          </div>

          <div className="mt-16 space-y-12">
            {content.how.items.map((step, index) => (
              <div key={step.titleKey} className="flex gap-8">
                <span className={cn(styles.display, "text-5xl font-light text-primary/20")}>
                  {index + 1}
                </span>
                <div className="border-l border-border/50 pl-8 pt-1">
                  <h3 className={cn(styles.display, "text-xl font-normal text-foreground")}>
                    {t(step.titleKey)}
                  </h3>
                  <p
                    className={cn(
                      styles.body,
                      "mt-2 font-light leading-relaxed text-muted-foreground",
                    )}
                  >
                    {t(step.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2
            className={cn(
              styles.display,
              "text-center text-4xl font-light text-foreground sm:text-5xl",
            )}
          >
            {t("landing.faq.title")}
          </h2>
          <div className={cn(styles.goldLine, "mx-auto mt-5")} />

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div key={item.questionKey} className="border-t border-border/30 pt-6">
                <h3 className={cn(styles.display, "text-lg text-foreground")}>
                  {t(item.questionKey)}
                </h3>
                <p
                  className={cn(
                    styles.body,
                    "mt-2 text-sm font-light leading-relaxed text-muted-foreground",
                  )}
                >
                  {t(item.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className={cn(styles.display, "text-4xl font-light italic text-foreground sm:text-6xl")}
          >
            {t(content.cta.titleKey)}
          </h2>
          <p className={cn(styles.body, "mt-5 font-light text-muted-foreground")}>
            {t(content.cta.subtitleKey)}
          </p>
          <div className="mt-10 flex flex-col justify-center gap-5 sm:flex-row">
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
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <p className={cn(styles.body, "mt-6 text-xs font-light text-muted-foreground/50")}>
            {t("landing.cta.risk")}
          </p>
        </div>
      </section>

      <VariantSwitcher current="26" className="border-border/30 bg-background/60 backdrop-blur" />
    </div>
  );
}
