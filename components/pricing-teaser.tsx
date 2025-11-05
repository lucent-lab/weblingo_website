import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Translator } from "@internal/i18n";
import { pricingTiers } from "@modules/pricing";

type PricingTeaserProps = {
  locale: string;
  t: Translator;
};

export function PricingTeaser({ locale, t }: PricingTeaserProps) {
  return (
    <section className="bg-muted pb-20 pt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Badge>{t("home.pricingTeaser.badge")}</Badge>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {t("home.pricingTeaser.title")}
          </h2>
          <p className="text-base text-muted-foreground">{t("home.pricingTeaser.subtitle")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={`/${locale}/pricing`}>{t("home.pricingTeaser.ctaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/contact`}>{t("home.pricingTeaser.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.id}
              className={tier.highlighted ? "border-primary/40 shadow-lg shadow-primary/10" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t(tier.nameKey)}</CardTitle>
                  {tier.highlighted ? (
                    <Badge variant="outline">{t("pricing.tiers.mostPopular")}</Badge>
                  ) : null}
                </div>
                <CardDescription>{t(tier.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold text-primary">{tier.monthlyPrice}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {t("pricing.table.monthlyLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("pricing.table.yearlyHint", undefined, { price: tier.yearlyPrice })}
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {tier.featureKeys.map((featureKey) => (
                    <li
                      key={featureKey}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-foreground"
                    >
                      {t(featureKey)}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <Link href={`/${locale}/checkout?plan=${tier.id}`}>
                    {t("pricing.tiers.checkout")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
