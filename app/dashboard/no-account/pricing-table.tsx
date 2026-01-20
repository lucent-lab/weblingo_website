"use client";

import Script from "next/script";

type PricingEmbedProps = {
  pricingTableId: string;
  publishableKey: string;
};

export function PricingTableEmbed({ pricingTableId, publishableKey }: PricingEmbedProps) {
  if (!pricingTableId || !publishableKey) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <Script src="https://js.stripe.com/v3/pricing-table.js" async />
      <stripe-pricing-table pricing-table-id={pricingTableId} publishable-key={publishableKey} />
    </div>
  );
}
