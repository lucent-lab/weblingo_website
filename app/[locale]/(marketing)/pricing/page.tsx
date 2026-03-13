import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";
import { pricingTiers } from "@modules/pricing";

const planIds = ["launch", "growth", "enterprise"] as const;
const CHECK_MARKER = "✅";

const renderComparisonValue = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith(CHECK_MARKER)) {
    const suffix = trimmed.slice(CHECK_MARKER.length).trim();
    return (
      <div className="flex items-center justify-center gap-2">
        <Check className="h-5 w-5 text-primary" />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
};

const formatTierPrice = (monthlyPrice: string, yearlyPrice: string) =>
  `${monthlyPrice} (${yearlyPrice})`;

const getPricingTier = (id: (typeof pricingTiers)[number]["id"]) => {
  const tier = pricingTiers.find((candidate) => candidate.id === id);
  if (!tier) {
    throw new Error(`Missing pricing tier: ${id}`);
  }
  return tier;
};

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const starterTier = getPricingTier("starter");
  const proTier = getPricingTier("pro");
  const agencyTier = getPricingTier("agency");

  const planLabels = {
    starter: t("pricing.tiers.launch.name"),
    pro: t("pricing.tiers.growth.name"),
    agency: t("pricing.tiers.enterprise.name"),
  };

  const comparisonRows = [
    {
      id: "websitesIncluded",
      label: t("pricing.compare.rows.websitesIncluded.label"),
      starter: t("pricing.compare.rows.websitesIncluded.starter"),
      pro: t("pricing.compare.rows.websitesIncluded.pro"),
      agency: t("pricing.compare.rows.websitesIncluded.agency"),
    },
    {
      id: "languages",
      label: t("pricing.compare.rows.languages.label"),
      starter: t("pricing.compare.rows.languages.starter"),
      pro: t("pricing.compare.rows.languages.pro"),
      agency: t("pricing.compare.rows.languages.agency"),
    },
    {
      id: "hosting",
      label: t("pricing.compare.rows.hosting.label"),
      starter: t("pricing.compare.rows.hosting.starter"),
      pro: t("pricing.compare.rows.hosting.pro"),
      agency: t("pricing.compare.rows.hosting.agency"),
    },
    {
      id: "cdn",
      label: t("pricing.compare.rows.cdn.label"),
      starter: t("pricing.compare.rows.cdn.starter"),
      pro: t("pricing.compare.rows.cdn.pro"),
      agency: t("pricing.compare.rows.cdn.agency"),
    },
    {
      id: "autodeploy",
      label: t("pricing.compare.rows.autodeploy.label"),
      starter: t("pricing.compare.rows.autodeploy.starter"),
      pro: t("pricing.compare.rows.autodeploy.pro"),
      agency: t("pricing.compare.rows.autodeploy.agency"),
    },
    {
      id: "editor",
      label: t("pricing.compare.rows.editor.label"),
      starter: t("pricing.compare.rows.editor.starter"),
      pro: t("pricing.compare.rows.editor.pro"),
      agency: t("pricing.compare.rows.editor.agency"),
    },
    {
      id: "glossary",
      label: t("pricing.compare.rows.glossary.label"),
      starter: t("pricing.compare.rows.glossary.starter"),
      pro: t("pricing.compare.rows.glossary.pro"),
      agency: t("pricing.compare.rows.glossary.agency"),
    },
    {
      id: "seo",
      label: t("pricing.compare.rows.seo.label"),
      starter: t("pricing.compare.rows.seo.starter"),
      pro: t("pricing.compare.rows.seo.pro"),
      agency: t("pricing.compare.rows.seo.agency"),
    },
    {
      id: "crawl",
      label: t("pricing.compare.rows.crawl.label"),
      starter: t("pricing.compare.rows.crawl.starter"),
      pro: t("pricing.compare.rows.crawl.pro"),
      agency: t("pricing.compare.rows.crawl.agency"),
    },
    {
      id: "team",
      label: t("pricing.compare.rows.team.label"),
      starter: t("pricing.compare.rows.team.starter"),
      pro: t("pricing.compare.rows.team.pro"),
      agency: t("pricing.compare.rows.team.agency"),
    },
    {
      id: "whitelabel",
      label: t("pricing.compare.rows.whitelabel.label"),
      starter: t("pricing.compare.rows.whitelabel.starter"),
      pro: t("pricing.compare.rows.whitelabel.pro"),
      agency: t("pricing.compare.rows.whitelabel.agency"),
    },
    {
      id: "multisite",
      label: t("pricing.compare.rows.multisite.label"),
      starter: t("pricing.compare.rows.multisite.starter"),
      pro: t("pricing.compare.rows.multisite.pro"),
      agency: t("pricing.compare.rows.multisite.agency"),
    },
    {
      id: "concierge",
      label: t("pricing.compare.rows.concierge.label"),
      starter: t("pricing.compare.rows.concierge.starter"),
      pro: t("pricing.compare.rows.concierge.pro"),
      agency: t("pricing.compare.rows.concierge.agency"),
    },
    {
      id: "pricing",
      label: t("pricing.compare.rows.pricing.label"),
      starter: formatTierPrice(starterTier.monthlyPrice, starterTier.yearlyPrice),
      pro: formatTierPrice(proTier.monthlyPrice, proTier.yearlyPrice),
      agency: formatTierPrice(agencyTier.monthlyPrice, agencyTier.yearlyPrice),
    },
  ];

  type PlanRow = {
    name: string;
    description: string;
    features: string[];
    note: string;
    price: string;
    websites: string;
    languages: string;
    ctaHref: string;
    ctaLabel: string;
    ctaExternal?: boolean;
    extra?: string;
  };

  const planRows: Record<(typeof planIds)[number], PlanRow> = {
    launch: {
      name: t("pricing.tiers.launch.name"),
      description: t("pricing.tiers.launch.description"),
      features: [
        t("pricing.tiers.launch.feature1"),
        t("pricing.tiers.launch.feature2"),
        t("pricing.tiers.launch.feature3"),
        t("pricing.tiers.launch.feature4"),
      ],
      note: t("pricing.tiers.launch.note"),
      price: formatTierPrice(starterTier.monthlyPrice, starterTier.yearlyPrice),
      websites: t("pricing.compare.rows.websitesIncluded.starter"),
      languages: t("pricing.compare.rows.languages.starter"),
      ctaHref: `/${locale}/login`,
      ctaLabel: t("pricing.tiers.checkout"),
    },
    growth: {
      name: t("pricing.tiers.growth.name"),
      description: t("pricing.tiers.growth.description"),
      features: [
        t("pricing.tiers.growth.feature1"),
        t("pricing.tiers.growth.feature2"),
        t("pricing.tiers.growth.feature3"),
        t("pricing.tiers.growth.feature4"),
      ],
      note: t("pricing.tiers.growth.note"),
      price: formatTierPrice(proTier.monthlyPrice, proTier.yearlyPrice),
      websites: t("pricing.compare.rows.websitesIncluded.pro"),
      languages: t("pricing.compare.rows.languages.pro"),
      ctaHref: `/${locale}/login`,
      ctaLabel: t("pricing.tiers.checkout"),
    },
    enterprise: {
      name: t("pricing.tiers.enterprise.name"),
      description: t("pricing.tiers.enterprise.description"),
      features: [
        t("pricing.tiers.enterprise.feature1"),
        t("pricing.tiers.enterprise.feature2"),
        t("pricing.tiers.enterprise.feature3"),
        t("pricing.tiers.enterprise.feature4"),
      ],
      note: t("pricing.tiers.enterprise.note"),
      extra: t("pricing.tiers.enterprise.additional"),
      price: formatTierPrice(agencyTier.monthlyPrice, agencyTier.yearlyPrice),
      websites: t("pricing.compare.rows.websitesIncluded.agency"),
      languages: t("pricing.compare.rows.languages.agency"),
      ctaHref: "mailto:contact@weblingo.app",
      ctaLabel: t("pricing.header.contactCta"),
      ctaExternal: true,
    },
  };

  const freePlanFeatures = [
    { id: "site", label: t("pricing.free.feature1") },
    { id: "glossary", label: t("pricing.free.feature2") },
    { id: "overrides", label: t("pricing.free.feature3") },
    { id: "quota", label: t("pricing.free.feature4") },
  ];

  const faqItems = [
    {
      id: "languages",
      question: t("pricing.faq.items.languages.question"),
      answer: t("pricing.faq.items.languages.answer"),
    },
    {
      id: "traffic",
      question: t("pricing.faq.items.traffic.question"),
      answer: t("pricing.faq.items.traffic.answer"),
    },
    {
      id: "setup",
      question: t("pricing.faq.items.setup.question"),
      answer: t("pricing.faq.items.setup.answer"),
    },
    {
      id: "cancel",
      question: t("pricing.faq.items.cancel.question"),
      answer: t("pricing.faq.items.cancel.answer"),
    },
    {
      id: "agencies",
      question: t("pricing.faq.items.agencies.question"),
      answer: t("pricing.faq.items.agencies.answer"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
            {t("pricing.header.tagline")}
          </Badge>
          <h1 className="mb-6 text-5xl font-bold text-balance text-foreground sm:text-6xl">
            {t("pricing.header.title")}
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-balance text-xl text-muted-foreground">
            {t("pricing.header.description")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href={`/${locale}/login`}>
                {t("pricing.free.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="mailto:contact@weblingo.app">{t("pricing.header.contactCta")}</a>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Badge variant="outline" className="px-4 py-2 text-sm font-normal">
              {t("pricing.header.fact")}
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm font-normal">
              {t("pricing.header.trust")}
            </Badge>
          </div>
        </div>
      </section>

      <section id="free-plan" className="px-4 pb-6 sm:px-6 sm:pb-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card>
            <CardContent className="flex flex-col gap-6 py-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{t("pricing.free.title")}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {t("pricing.free.price")} — {t("pricing.free.priceNote")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t("pricing.free.description")}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2">
                  {freePlanFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Check className="h-3.5 w-3.5 text-primary" />
                      <span>{feature.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <Button asChild size="default">
                  <Link href={`/${locale}/login`}>
                    {t("pricing.free.cta")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="default" variant="outline">
                  <Link href={`/${locale}/try`}>{t("pricing.free.previewCta")}</Link>
                </Button>
                <p className="max-w-xs text-xs text-muted-foreground">{t("pricing.free.note")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <h2 className="text-3xl font-bold text-balance text-foreground sm:text-4xl">
              {t("pricing.paid.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("pricing.paid.description")}</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {planIds.map((planId) => {
              const plan = planRows[planId];
              const highlight = planId === "growth" && Boolean(proTier.highlighted);
              return (
                <Card
                  key={planId}
                  className={
                    highlight
                      ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/10 md:scale-105"
                      : ""
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{plan.name}</CardTitle>
                      {highlight ? (
                        <Badge variant="outline">{t("pricing.tiers.mostPopular")}</Badge>
                      ) : null}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="border-t pt-6">
                      <p className="mb-1 text-sm text-muted-foreground">
                        {t("pricing.compare.rows.pricing.label")}
                      </p>
                      <p className="text-3xl font-bold text-foreground">{plan.price}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("pricing.compare.rows.websitesIncluded.label")} {plan.websites}
                        <br />
                        {t("pricing.compare.rows.languages.label")} {plan.languages}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      asChild
                      size="lg"
                      className="w-full"
                      variant={highlight ? "default" : "outline"}
                    >
                      {plan.ctaExternal ? (
                        <a href={plan.ctaHref}>{plan.ctaLabel}</a>
                      ) : (
                        <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                      )}
                    </Button>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      {t("pricing.compare.column.feature")}
                    </p>
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                        <span className="text-foreground">{feature}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">{plan.note}</p>
                    {plan.extra ? (
                      <p className="text-xs text-muted-foreground">{plan.extra}</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-3xl font-bold text-foreground sm:text-4xl">
            {t("pricing.compare.title")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-4 text-left font-semibold text-foreground">
                    {t("pricing.compare.column.feature")}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-foreground">
                    {planLabels.starter}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-foreground">
                    {planLabels.pro}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-foreground">
                    {planLabels.agency}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition hover:bg-background/50"
                  >
                    <td className="px-4 py-4 font-medium text-foreground">{row.label}</td>
                    <td className="px-4 py-4 text-center">{renderComparisonValue(row.starter)}</td>
                    <td className="px-4 py-4 text-center">{renderComparisonValue(row.pro)}</td>
                    <td className="px-4 py-4 text-center">{renderComparisonValue(row.agency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("pricing.compare.footnotes")}</p>
        </div>
      </section>

      <section id="pricing-faq" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-balance text-foreground sm:text-4xl">
              {t("pricing.faq.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("pricing.faq.description")}</p>
          </div>

          <div className="mt-10 space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.id}
                className="group rounded-lg border bg-card shadow-sm transition-colors hover:border-primary/20 open:border-primary/20"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-5 text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-4xl font-bold text-foreground sm:text-5xl">
            {t("pricing.final.title")}
          </h2>
          <p className="mb-12 text-lg text-muted-foreground">{t("pricing.final.description")}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href={`/${locale}/login`}>
                {t("pricing.final.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/try`}>{t("pricing.free.previewCta")}</Link>
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
    titleFallback: "Pricing",
    descriptionFallback:
      "Choose the plan that matches your rollout. Hosted on 330+ Cloudflare CDN locations.",
  });
}
