export type PricingTier = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  featureKeys: [string, string, string, string];
  monthlyPrice: string;
  yearlyPrice: string;
  priceIdMonthly: string;
  priceIdYearly: string;
  highlighted?: boolean;
};

export const SITE_ID = "web-lingo";

export const pricingTiers: PricingTier[] = [
  {
    id: "starter",
    nameKey: "pricing.tiers.launch.name",
    descriptionKey: "pricing.tiers.launch.description",
    featureKeys: [
      "pricing.tiers.launch.feature1",
      "pricing.tiers.launch.feature2",
      "pricing.tiers.launch.feature3",
      "pricing.tiers.launch.feature4",
    ],
    monthlyPrice: "¥4,800",
    yearlyPrice: "¥57,600",
    priceIdMonthly: "price_weblingo_starter_site_monthly",
    priceIdYearly: "price_weblingo_starter_site_yearly",
  },
  {
    id: "pro",
    nameKey: "pricing.tiers.growth.name",
    descriptionKey: "pricing.tiers.growth.description",
    featureKeys: [
      "pricing.tiers.growth.feature1",
      "pricing.tiers.growth.feature2",
      "pricing.tiers.growth.feature3",
      "pricing.tiers.growth.feature4",
    ],
    monthlyPrice: "¥8,800",
    yearlyPrice: "¥105,600",
    priceIdMonthly: "price_weblingo_pro_site_monthly",
    priceIdYearly: "price_weblingo_pro_site_yearly",
    highlighted: true,
  },
  {
    id: "agency",
    nameKey: "pricing.tiers.enterprise.name",
    descriptionKey: "pricing.tiers.enterprise.description",
    featureKeys: [
      "pricing.tiers.enterprise.feature1",
      "pricing.tiers.enterprise.feature2",
      "pricing.tiers.enterprise.feature3",
      "pricing.tiers.enterprise.feature4",
    ],
    monthlyPrice: "¥24,800",
    yearlyPrice: "¥297,600",
    priceIdMonthly: "price_weblingo_agency_base_monthly",
    priceIdYearly: "price_weblingo_agency_base_yearly",
  },
];
