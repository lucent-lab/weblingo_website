import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Translator } from "@internal/i18n";

import { pricingTiers } from "./data";

type PricingTableProps = {
  locale: string;
  t: Translator;
};

export function PricingTable({ locale, t }: PricingTableProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 md:grid-cols-3">
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
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-primary">{tier.monthlyPrice}</span>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {t("pricing.table.monthlyLabel")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("pricing.table.yearlyHint", undefined, { price: tier.yearlyPrice })}
            </p>
            <ul className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
              {tier.featureKeys.map((featureKey) => (
                <li
                  key={featureKey}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-foreground"
                >
                  {t(featureKey)}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full" size="lg">
              <Link href={`/${locale}/checkout?plan=${tier.id}`}>
                {t("pricing.tiers.checkout")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
