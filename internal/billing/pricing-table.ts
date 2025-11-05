import { env } from "@internal/core";
import { normalizeLocale, type Locale } from "@internal/i18n";

const localePricingTableMap: Partial<Record<Locale, string | undefined>> = {
  en: env.STRIPE_PRICING_TABLE_ID_EN,
  fr: env.STRIPE_PRICING_TABLE_ID_FR,
  ja: env.STRIPE_PRICING_TABLE_ID_JA,
};

export function getPricingTableId(locale: string) {
  const normalized = normalizeLocale(locale);
  const localeSpecific = localePricingTableMap[normalized] ?? null;
  const fallback = env.STRIPE_PRICING_TABLE_ID ?? null;
  const pricingTableId = localeSpecific ?? fallback;

  if (!pricingTableId) {
    throw new Error(`Missing Stripe pricing table ID for locale "${normalized}".`);
  }

  return pricingTableId;
}
