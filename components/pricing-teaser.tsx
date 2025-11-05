import Script from "next/script";

import { getPricingTableId } from "@internal/billing";
import { env } from "@internal/core";
import type { Translator } from "@internal/i18n";

type PricingTeaserProps = {
  locale: string;
  t: Translator;
};

export function PricingTeaser({ locale, t }: PricingTeaserProps) {
  const pricingTableId = getPricingTableId(locale);
  const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!pricingTableId || !publishableKey) {
    throw new Error("Missing required Stripe configuration");
  }

  if (!/^pk_(test|live)_/.test(publishableKey)) {
    throw new Error("Invalid Stripe publishable key format");
  }

  return (
    <section className="bg-background pb-20 pt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6">
        <Script src="https://js.stripe.com/v3/pricing-table.js" async />
        <stripe-pricing-table pricing-table-id={pricingTableId} publishable-key={publishableKey} />
        <div className="space-y-2 text-center text-sm text-foreground">
          <p>{t("pricing.header.fact")}</p>
          <p>{t("pricing.addons.languages")}</p>
          <p>{t("pricing.addons.support")}</p>
        </div>
      </div>
    </section>
  );
}
