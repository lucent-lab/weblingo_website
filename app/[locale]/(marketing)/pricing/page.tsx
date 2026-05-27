import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { AnalyticsTrackedLink } from "@/components/analytics-tracked-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, buildCtaAnalyticsProperties } from "@internal/analytics/events";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

const rolloutCardIds = ["preview", "pilot", "agency"] as const;
const faqIds = ["scope", "checkout", "agency", "updates"] as const;

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const pricingPagePath = `/${locale}/pricing`;
  const previewHref = `/${locale}#try`;
  const contactHref = `/${locale}/contact`;

  return (
    <div className="min-h-screen bg-background">
      <section className="section-reveal relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
            {t("pricing.header.tagline")}
          </Badge>
          <h1 className="mb-6 text-4xl font-bold text-balance text-foreground sm:text-6xl">
            {t("pricing.header.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-xl text-muted-foreground">
            {t("pricing.header.description")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <AnalyticsTrackedLink
                analyticsProperties={buildCtaAnalyticsProperties({
                  ctaId: "pricing_header_private_preview",
                  locale,
                  pagePath: pricingPagePath,
                  pageType: "pricing",
                  targetHref: previewHref,
                })}
                event={ANALYTICS_EVENTS.pricingCtaClicked}
                href={previewHref}
              >
                {t("nav.try")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </AnalyticsTrackedLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <AnalyticsTrackedLink
                analyticsProperties={buildCtaAnalyticsProperties({
                  ctaId: "pricing_header_rollout_contact",
                  locale,
                  pagePath: pricingPagePath,
                  pageType: "pricing",
                  targetHref: contactHref,
                })}
                event={ANALYTICS_EVENTS.pricingCtaClicked}
                href={contactHref}
              >
                {t("pricing.header.contactCta")}
              </AnalyticsTrackedLink>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{t("pricing.header.fact")}</p>
        </div>
      </section>

      <section id="pricing-table" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t("pricing.paid.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("pricing.paid.description")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {rolloutCardIds.map((id) => (
              <article key={id} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  {t(`pricing.rollout.${id}.eyebrow`)}
                </p>
                <h3 className="mt-4 text-2xl font-bold text-foreground">
                  {t(`pricing.rollout.${id}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t(`pricing.rollout.${id}.description`)}
                </p>
                <ul className="mt-6 space-y-3">
                  {[1, 2, 3].map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{t(`pricing.rollout.${id}.feature${feature}`)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t("pricing.faq.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("pricing.faq.description")}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {faqIds.map((id) => (
              <article key={id} className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  {t(`pricing.faq.items.${id}.question`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`pricing.faq.items.${id}.answer`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            {t("pricing.final.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("pricing.final.description")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <AnalyticsTrackedLink
                analyticsProperties={buildCtaAnalyticsProperties({
                  ctaId: "pricing_final_private_preview",
                  locale,
                  pagePath: pricingPagePath,
                  pageType: "pricing",
                  targetHref: previewHref,
                })}
                event={ANALYTICS_EVENTS.pricingCtaClicked}
                href={previewHref}
              >
                {t("nav.try")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </AnalyticsTrackedLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <AnalyticsTrackedLink
                analyticsProperties={buildCtaAnalyticsProperties({
                  ctaId: "pricing_final_rollout_contact",
                  locale,
                  pagePath: pricingPagePath,
                  pageType: "pricing",
                  targetHref: contactHref,
                })}
                event={ANALYTICS_EVENTS.pricingCtaClicked}
                href={contactHref}
              >
                {t("pricing.header.contactCta")}
              </AnalyticsTrackedLink>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }
  return createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: "pricing.header.title",
    descriptionKey: "pricing.header.description",
    titleFallback: "Scope a WebLingo private preview or production pilot",
    descriptionFallback:
      "Generate a private preview first, then talk through a public-page localization pilot when you are ready to evaluate production rollout.",
  });
}
