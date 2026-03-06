/**
 * Variant 36 — Based on the expansion segment landing page (segment-page.tsx)
 * with targeted UX improvements from docs/landing-page-ux-improvements.md:
 *
 *  #2  Gradient accent on the hero title (rotating word included)
 *  #3  Compact trust bar replacing heavy stat cards
 *  #5  Before/after comparison replacing the pain card grid
 *  #8  FAQ accordion (native details/summary) replacing flat cards
 *  #9  CTA social proof avatar stack
 *  #10 Section entrance animations (staggered fade-up)
 *  #11 Staggered use-case grid + wave separators between sections
 *
 * Reuses HeroOutcomeRotator, HowStepsTimeline, InViewCountUp from
 * the original landing module (they bring their own CSS via segment-page.module.css).
 */
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";

import { TryForm } from "@/components/try-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroOutcomeRotator } from "@modules/landing/components/hero-outcome-rotator";
import { HowStepsTimeline } from "@modules/landing/components/how-steps-timeline";
import { InViewCountUp } from "@modules/landing/components/in-view-count-up";
import { LANDING_FAQ_ITEMS, VariantSwitcher, type LandingVariantProps } from "./shared";
import styles from "./variant-36.module.css";

export function LandingVariant36({
  locale,
  messages,
  t,
  content,
  supportedLanguages,
  hasPreviewConfig,
}: LandingVariantProps) {
  const heroOutcomes = content.hero.rotatorOutcomeKeys.map((key) => t(key));
  const howSteps = content.how.items.map((item) => ({
    title: t(item.titleKey),
    body: t(item.bodyKey),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero (same layout as expansion, #2 gradient title, #3 trust bar) ── */}
      <section
        id="try"
        className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32"
      >
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: headline */}
            <div className="text-center lg:text-left">
              {/* #2: Gradient accent wraps the rotating headline */}
              <h1
                className={cn(
                  "mb-6 text-5xl font-bold leading-tight text-balance sm:text-6xl lg:text-7xl",
                  styles.heroGradient,
                )}
              >
                <HeroOutcomeRotator
                  outcomes={heroOutcomes}
                  prefix={t(content.hero.rotatorPrefixKey)}
                />
              </h1>

              <p className="mb-5 text-balance text-xl text-muted-foreground leading-relaxed lg:max-w-2xl">
                {t(content.hero.subtitleKey)}
              </p>

              {/* #3: Compact trust bar replaces the 3 stat cards */}
              <div className={cn(styles.trustBar, "mt-8")}>
                {content.stats.map((stat, idx) => {
                  const raw = t(stat.valueKey);
                  const num = Number.parseInt(raw.replace(/[^0-9]/g, ""), 10);
                  const suffix = raw.replace(/[0-9]/g, "").trim();
                  const canCount = idx === 0 && Number.isFinite(num) && num > 0;
                  return (
                    <span
                      key={stat.valueKey}
                      className={styles.trustChip}
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <span className={styles.trustChipValue}>
                        {canCount ? (
                          <InViewCountUp
                            ariaLabel={`${raw} ${t(stat.labelKey)}`}
                            suffix={suffix}
                            target={num}
                          />
                        ) : (
                          raw
                        )}
                      </span>
                      {t(stat.labelKey)}
                    </span>
                  );
                })}
              </div>

              <p className="mt-5 text-sm text-muted-foreground">{t("landing.hero.guardrail")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("home.hero.trust")}</p>
            </div>

            {/* Right: try form (identical to expansion) */}
            <div className="relative lg:justify-self-end">
              <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur lg:max-w-md">
                <div className="mb-4 flex items-center">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {t("try.header.tagline")}
                  </span>
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  {t("try.header.title")}
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">{t("try.header.description")}</p>
                <TryForm
                  locale={locale}
                  messages={messages}
                  disabled={!hasPreviewConfig}
                  supportedLanguages={supportedLanguages}
                  showEmailField
                  primaryButtonClassName={styles.buttonMicro}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* #11: Wave separator */}
      <svg className={styles.waveSeparator} viewBox="0 0 1440 48" preserveAspectRatio="none">
        <path d="M0 16c240 20 480-12 720 0s480 20 720 0v32H0z" fill="currentColor" />
      </svg>

      {/* ── Pain: #5 Before/After comparison ── */}
      <section
        className={cn(
          "bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8",
          styles.sectionEntrance,
        )}
        style={{ animationDelay: "100ms" }}
      >
        <div className="mx-auto max-w-6xl">
          {/* Title + subtitle (same as expansion, left-aligned) */}
          <div className="mb-12 max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
              {t(content.pain.titleKey)}
            </h2>
            <p className="text-lg text-muted-foreground">{t(content.pain.subtitleKey)}</p>
          </div>

          {/* #5: Two-column before/after */}
          <div className={styles.comparisonGrid}>
            {/* "Before" — pain items with X icons */}
            <div className={cn(styles.comparisonCard, styles.comparisonBefore)}>
              <div className={cn(styles.comparisonLabel, styles.comparisonLabelBefore)}>
                <X className="h-3 w-3" />
                {t(content.pain.costTitleKey)}
              </div>
              {content.pain.items.map((item) => (
                <div key={item.titleKey} className={styles.comparisonItem}>
                  <X className={cn("h-4 w-4 text-destructive", styles.comparisonIcon)} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </div>
              ))}
              <p className="mt-4 text-xs text-destructive/70">{t(content.pain.costBodyKey)}</p>
            </div>

            {/* "After" — solution with check icons + social proof */}
            <div className={cn(styles.comparisonCard, styles.comparisonAfter)}>
              <div className={cn(styles.comparisonLabel, styles.comparisonLabelAfter)}>
                <Check className="h-3 w-3" />
                WebLingo
              </div>
              {content.useCases.items.map((item) => (
                <div key={item.titleKey} className={styles.comparisonItem}>
                  <Check className={cn("h-4 w-4 text-primary", styles.comparisonIcon)} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </div>
              ))}

              {/* Social proof stats inline (from original pain callout) */}
              <div className="mt-4 flex flex-wrap gap-4 border-t border-primary/10 pt-4">
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className="text-lg font-bold text-foreground">
                    <InViewCountUp
                      ariaLabel={t("landing.cost.callout.stat.1.value")}
                      suffix="%"
                      target={76}
                    />
                  </span>
                  <span className="text-muted-foreground">
                    {t("landing.cost.callout.stat.1.label")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className="text-lg font-bold text-foreground">
                    <InViewCountUp
                      ariaLabel={t("landing.cost.callout.stat.2.value")}
                      suffix="%"
                      target={40}
                    />
                  </span>
                  <span className="text-muted-foreground">
                    {t("landing.cost.callout.stat.2.label")}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-primary/60">{t("landing.cost.callout.source")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use cases: #11 staggered grid ── */}
      <section
        id="features"
        className={cn("px-4 py-16 sm:px-6 sm:py-24 lg:px-8", styles.sectionEntrance)}
        style={{ animationDelay: "150ms" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
              {t(content.useCases.titleKey)}
            </h2>
            <p className="mx-auto max-w-3xl text-muted-foreground">
              {t(content.useCases.subtitleKey)}
            </p>
          </div>

          <div className={styles.useCaseGrid}>
            {/* Featured card — first use case, large */}
            {content.useCases.items[0] &&
              (() => {
                const featured = content.useCases.items[0];
                const FeaturedIcon = featured.icon;
                return (
                  <div className={styles.useCaseFeatured}>
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FeaturedIcon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {t(featured.titleKey)}
                    </h3>
                    <p className="mt-3 text-muted-foreground leading-relaxed">
                      {t(featured.bodyKey)}
                    </p>
                  </div>
                );
              })()}

            {/* Smaller stacked cards */}
            {content.useCases.items.slice(1).map((item) => (
              <div key={item.titleKey} className={styles.useCaseSmall}>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* #11: Wave separator (inverted) */}
      <svg className={styles.waveSeparator} viewBox="0 0 1440 48" preserveAspectRatio="none">
        <path d="M0 32c240-20 480 12 720 0s480-20 720 0V0H0z" fill="currentColor" />
      </svg>

      {/* ── How it works (same HowStepsTimeline as expansion) ── */}
      <section
        id="how-it-works"
        className={cn(
          "bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8",
          styles.sectionEntrance,
        )}
        style={{ animationDelay: "200ms" }}
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.how.titleKey)}
          </h2>
          <HowStepsTimeline steps={howSteps} />
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("landing.expansion.how.risk")}
          </p>
        </div>
      </section>

      {/* ── FAQ: #8 accordion ── */}
      <section
        className={cn("px-4 py-16 sm:px-6 sm:py-24 lg:px-8", styles.sectionEntrance)}
        style={{ animationDelay: "250ms" }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t("landing.faq.title")}
          </h2>
          <div className="space-y-3">
            {LANDING_FAQ_ITEMS.map((item) => (
              <details key={item.questionKey} className={styles.faqItem}>
                <summary className={styles.faqSummary}>
                  <span>{t(item.questionKey)}</span>
                  <ChevronDown className={styles.faqChevron} />
                </summary>
                <div className={styles.faqAnswer}>{t(item.answerKey)}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA: #9 social proof ── */}
      <section className={cn("px-4 py-16 sm:px-6 sm:py-24 lg:px-8", styles.ctaSection)}>
        <div className="mx-auto max-w-4xl text-center">
          {/* #9: Avatar stack */}
          <div className={cn(styles.ctaAvatarStack, "mb-6")}>
            {["FG", "AL", "MK", "JD", "SR"].map((initials) => (
              <span key={initials} className={styles.ctaAvatar}>
                {initials}
              </span>
            ))}
            <span className="ml-3 text-sm text-muted-foreground">50+ teams already testing</span>
          </div>

          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t(content.cta.titleKey)}
          </h2>
          <p className="mb-10 text-lg text-muted-foreground">{t(content.cta.subtitleKey)}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className={cn("bg-primary hover:bg-primary/90", styles.buttonMicro)}
            >
              <Link href={`/${locale}#try`}>
                {t(content.cta.primaryKey)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:contact@weblingo.app">{t(content.cta.secondaryKey)}</a>
            </Button>
          </div>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>{t("landing.cta.risk")}</p>
            <p>{t("landing.cta.startSmall")}</p>
          </div>
        </div>
      </section>

      <VariantSwitcher current="36" />
    </div>
  );
}
