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
    id: "launch",
    nameKey: "pricing.tiers.launch.name",
    descriptionKey: "pricing.tiers.launch.description",
    featureKeys: [
      "pricing.tiers.launch.feature1",
      "pricing.tiers.launch.feature2",
      "pricing.tiers.launch.feature3",
      "pricing.tiers.launch.feature4",
    ],
    monthlyPrice: "$29",
    yearlyPrice: "$290",
    priceIdMonthly: "price_weblingo_launch_monthly",
    priceIdYearly: "price_weblingo_launch_yearly",
  },
  {
    id: "growth",
    nameKey: "pricing.tiers.growth.name",
    descriptionKey: "pricing.tiers.growth.description",
    featureKeys: [
      "pricing.tiers.growth.feature1",
      "pricing.tiers.growth.feature2",
      "pricing.tiers.growth.feature3",
      "pricing.tiers.growth.feature4",
    ],
    monthlyPrice: "$99",
    yearlyPrice: "$990",
    priceIdMonthly: "price_weblingo_growth_monthly",
    priceIdYearly: "price_weblingo_growth_yearly",
    highlighted: true,
  },
  {
    id: "enterprise",
    nameKey: "pricing.tiers.enterprise.name",
    descriptionKey: "pricing.tiers.enterprise.description",
    featureKeys: [
      "pricing.tiers.enterprise.feature1",
      "pricing.tiers.enterprise.feature2",
      "pricing.tiers.enterprise.feature3",
      "pricing.tiers.enterprise.feature4",
    ],
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    priceIdMonthly: "price_weblingo_enterprise_monthly",
    priceIdYearly: "price_weblingo_enterprise_yearly",
  },
];
