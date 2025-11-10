import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingTeaser } from "@/components/pricing-teaser";
import { createLocalizedMetadata, resolveLocaleTranslator } from "@internal/i18n";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await resolveLocaleTranslator(params);

  const comparisonRows = [
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
      label: t("pricing.compare.rows.languages.label"),
      starter: t("pricing.compare.rows.languages.starter"),
      pro: t("pricing.compare.rows.languages.pro"),
      agency: t("pricing.compare.rows.languages.agency"),
    },
    {
      label: t("pricing.compare.rows.pricing.label"),
      starter: t("pricing.compare.rows.pricing.starter"),
      pro: t("pricing.compare.rows.pricing.pro"),
      agency: t("pricing.compare.rows.pricing.agency"),
    },
  ];

  const faqItems = [
    {
      question: t("pricing.faq.items.languages.question"),
      answer: t("pricing.faq.items.languages.answer"),
    },
    {
      question: t("pricing.faq.items.traffic.question"),
      answer: t("pricing.faq.items.traffic.answer"),
    },
    {
      question: t("pricing.faq.items.agencies.question"),
      answer: t("pricing.faq.items.agencies.answer"),
    },
  ];

  return (
    <div className="bg-background pb-24 pt-20">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">
          {t("pricing.header.tagline")}
        </p>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
          {t("pricing.header.title")}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t("pricing.header.description")}
        </p>
        <Button asChild size="lg">
          <Link href={`/${locale}/contact`}>{t("pricing.header.contactCta")}</Link>
        </Button>
      </section>

      <PricingTeaser locale={locale} t={t} />

      <section id="compare" className="mx-auto mt-16 w-full max-w-6xl px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {t("pricing.compare.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm text-muted-foreground">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t("pricing.compare.column.feature")}</th>
                    <th className="py-2 px-4 font-medium text-center">
                      {t("pricing.tiers.launch.name")}
                    </th>
                    <th className="py-2 px-4 font-medium text-center">
                      {t("pricing.tiers.growth.name")}
                    </th>
                    <th className="py-2 pl-4 font-medium text-center">
                      {t("pricing.tiers.enterprise.name")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <th className="py-3 pr-4 text-left font-medium text-foreground">
                        {row.label}
                      </th>
                      <td className="py-3 px-4 text-center">{row.starter}</td>
                      <td className="py-3 px-4 text-center">{row.pro}</td>
                      <td className="py-3 pl-4 text-center">{row.agency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="faq" className="mx-auto mt-16 w-full max-w-4xl px-6">
        <h2 className="text-2xl font-semibold text-foreground">{t("pricing.faq.title")}</h2>
        <div className="mt-6 space-y-6">
          {faqItems.map((item) => (
            <Card key={item.question} className="border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {item.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
          <p className="text-sm text-muted-foreground">{t("pricing.faq.contact")}</p>
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
  return createLocalizedMetadata(params, {
    titleKey: "pricing.header.title",
    descriptionKey: "pricing.header.description",
    titleFallback: "Pricing",
    descriptionFallback:
      "Choose the plan that matches your rollout. Hosting, automation, and translations ready to publish are included in every tier.",
  });
}
