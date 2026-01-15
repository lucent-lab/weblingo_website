import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

const planIds = ["launch", "growth", "enterprise"] as const;

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  const comparisonRows = [
    {
      label: t("pricing.compare.rows.websitesIncluded.label"),
      starter: t("pricing.compare.rows.websitesIncluded.starter"),
      pro: t("pricing.compare.rows.websitesIncluded.pro"),
      agency: t("pricing.compare.rows.websitesIncluded.agency"),
    },
    {
      label: t("pricing.compare.rows.languages.label"),
      starter: t("pricing.compare.rows.languages.starter"),
      pro: t("pricing.compare.rows.languages.pro"),
      agency: t("pricing.compare.rows.languages.agency"),
    },
    {
      label: t("pricing.compare.rows.hosting.label"),
      starter: t("pricing.compare.rows.hosting.starter"),
      pro: t("pricing.compare.rows.hosting.pro"),
      agency: t("pricing.compare.rows.hosting.agency"),
    },
    {
      label: t("pricing.compare.rows.cdn.label"),
      starter: t("pricing.compare.rows.cdn.starter"),
      pro: t("pricing.compare.rows.cdn.pro"),
      agency: t("pricing.compare.rows.cdn.agency"),
    },
    {
      label: t("pricing.compare.rows.autodeploy.label"),
      starter: t("pricing.compare.rows.autodeploy.starter"),
      pro: t("pricing.compare.rows.autodeploy.pro"),
      agency: t("pricing.compare.rows.autodeploy.agency"),
    },
    {
      label: t("pricing.compare.rows.editor.label"),
      starter: t("pricing.compare.rows.editor.starter"),
      pro: t("pricing.compare.rows.editor.pro"),
      agency: t("pricing.compare.rows.editor.agency"),
    },
    {
      label: t("pricing.compare.rows.glossary.label"),
      starter: t("pricing.compare.rows.glossary.starter"),
      pro: t("pricing.compare.rows.glossary.pro"),
      agency: t("pricing.compare.rows.glossary.agency"),
    },
    {
      label: t("pricing.compare.rows.seo.label"),
      starter: t("pricing.compare.rows.seo.starter"),
      pro: t("pricing.compare.rows.seo.pro"),
      agency: t("pricing.compare.rows.seo.agency"),
    },
    {
      label: t("pricing.compare.rows.crawl.label"),
      starter: t("pricing.compare.rows.crawl.starter"),
      pro: t("pricing.compare.rows.crawl.pro"),
      agency: t("pricing.compare.rows.crawl.agency"),
    },
    {
      label: t("pricing.compare.rows.team.label"),
      starter: t("pricing.compare.rows.team.starter"),
      pro: t("pricing.compare.rows.team.pro"),
      agency: t("pricing.compare.rows.team.agency"),
    },
    {
      label: t("pricing.compare.rows.whitelabel.label"),
      starter: t("pricing.compare.rows.whitelabel.starter"),
      pro: t("pricing.compare.rows.whitelabel.pro"),
      agency: t("pricing.compare.rows.whitelabel.agency"),
    },
    {
      label: t("pricing.compare.rows.multisite.label"),
      starter: t("pricing.compare.rows.multisite.starter"),
      pro: t("pricing.compare.rows.multisite.pro"),
      agency: t("pricing.compare.rows.multisite.agency"),
    },
    {
      label: t("pricing.compare.rows.concierge.label"),
      starter: t("pricing.compare.rows.concierge.starter"),
      pro: t("pricing.compare.rows.concierge.pro"),
      agency: t("pricing.compare.rows.concierge.agency"),
    },
    {
      label: t("pricing.compare.rows.pricing.label"),
      starter: t("pricing.compare.rows.pricing.starter"),
      pro: t("pricing.compare.rows.pricing.pro"),
      agency: t("pricing.compare.rows.pricing.agency"),
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
      price: t("pricing.compare.rows.pricing.starter"),
      websites: t("pricing.compare.rows.websitesIncluded.starter"),
      languages: t("pricing.compare.rows.languages.starter"),
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
      price: t("pricing.compare.rows.pricing.pro"),
      websites: t("pricing.compare.rows.websitesIncluded.pro"),
      languages: t("pricing.compare.rows.languages.pro"),
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
      price: t("pricing.compare.rows.pricing.agency"),
      websites: t("pricing.compare.rows.websitesIncluded.agency"),
      languages: t("pricing.compare.rows.languages.agency"),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-block rounded-full border border-border bg-secondary px-4 py-2">
            <span className="text-sm font-medium text-secondary-foreground">
              {t("pricing.header.tagline")}
            </span>
          </div>
          <h1 className="mb-6 text-5xl font-bold text-balance text-foreground sm:text-6xl">
            {t("pricing.header.title")}
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-balance text-xl text-muted-foreground">
            {t("pricing.header.description")}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href={`/${locale}/contact`}>
                {t("pricing.header.contactCta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t("pricing.header.trust")}</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            {planIds.map((planId) => {
              const plan = planRows[planId];
              const highlight = planId === "growth";
              return (
                <div
                  key={planId}
                  className={`rounded-lg border transition-all ${
                    highlight
                      ? "border-primary bg-primary/5 shadow-lg md:scale-105"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {highlight ? (
                    <div className="rounded-t-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
                      {t("pricing.tiers.mostPopular")}
                    </div>
                  ) : null}
                  <div className="p-8">
                    <h3 className="mb-2 text-2xl font-bold text-foreground">{plan.name}</h3>
                    <p className="mb-6 text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mb-6 border-b border-border pb-6">
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
                    <Button
                      size="lg"
                      className="mb-8 w-full"
                      variant={highlight ? "default" : "outline"}
                      disabled
                    >
                      {t("pricing.tiers.comingSoon")}
                    </Button>
                    <div className="space-y-4">
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
                    </div>
                  </div>
                </div>
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
                  <th className="py-4 px-4 text-left font-semibold text-foreground">
                    {t("pricing.compare.column.feature")}
                  </th>
                  <th className="py-4 px-4 text-center font-semibold text-foreground">
                    {t("pricing.tiers.launch.name")}
                  </th>
                  <th className="py-4 px-4 text-center font-semibold text-foreground">
                    {t("pricing.tiers.growth.name")}
                  </th>
                  <th className="py-4 px-4 text-center font-semibold text-foreground">
                    {t("pricing.tiers.enterprise.name")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-border transition hover:bg-background/50"
                  >
                    <td className="py-4 px-4 font-medium text-foreground">{row.label}</td>
                    <td className="py-4 px-4 text-center">
                      {row.starter === "✅" ? (
                        <Check className="mx-auto h-5 w-5 text-primary" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {row.pro === "✅" ? (
                        <Check className="mx-auto h-5 w-5 text-primary" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{row.pro}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {row.agency === "✅" ? (
                        <Check className="mx-auto h-5 w-5 text-primary" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{row.agency}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("pricing.compare.footnotes")}</p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-4xl font-bold text-foreground sm:text-5xl">
            {t("home.final.title")}
          </h2>
          <p className="mb-12 text-lg text-muted-foreground">{t("home.final.subtitle")}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href={`/${locale}/try`}>
                {t("home.final.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/contact`}>{t("pricing.header.contactCta")}</Link>
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
