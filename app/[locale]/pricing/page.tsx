import Link from "next/link";
import Script from "next/script";

import { Button } from "@/components/ui/button";
import { PricingTable as FallbackPricingTable } from "@modules/pricing";
import { getPricingTableId } from "@internal/billing";
import { env } from "@internal/core";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  const pricingTableId = getPricingTableId(locale);
  const publishableKey = env.STRIPE_PUBLIC_KEY;

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

      <section className="mx-auto mt-16 w-full max-w-5xl px-6">
        <Script src="https://js.stripe.com/v3/pricing-table.js" async />
        <stripe-pricing-table
          pricing-table-id={pricingTableId}
          publishable-key={publishableKey}
          className="w-full"
        />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("pricing.embed.disclaimer")}
        </p>
      </section>

      <section className="mx-auto mt-20 w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground">{t("pricing.fallback.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("pricing.fallback.description")}
          </p>
          <div className="mt-8">
            <FallbackPricingTable locale={locale} t={t} />
          </div>
        </div>
      </section>
    </div>
  );
}
