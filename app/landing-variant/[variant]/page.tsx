import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SUPPORTED_LANGUAGES_STATIC } from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";
import { landingContent } from "@modules/landing/content";
import { LandingVariant1 } from "@modules/landing-variants/variant-1";
import { LandingVariant2 } from "@modules/landing-variants/variant-2";
import { LandingVariant3 } from "@modules/landing-variants/variant-3";
import { LandingVariant4 } from "@modules/landing-variants/variant-4";
import { LandingVariant5 } from "@modules/landing-variants/variant-5";
import { LandingVariant6 } from "@modules/landing-variants/variant-6";
import { LandingVariant7 } from "@modules/landing-variants/variant-7";
import { LandingVariant8 } from "@modules/landing-variants/variant-8";
import { LandingVariant9 } from "@modules/landing-variants/variant-9";
import { LandingVariant10 } from "@modules/landing-variants/variant-10";
import { LandingVariant11 } from "@modules/landing-variants/variant-11";
import { LandingVariant12 } from "@modules/landing-variants/variant-12";
import { LandingVariant13 } from "@modules/landing-variants/variant-13";
import { LandingVariant14 } from "@modules/landing-variants/variant-14";
import { LandingVariant15 } from "@modules/landing-variants/variant-15";
import { LandingVariant16 } from "@modules/landing-variants/variant-16";
import { LandingVariant17 } from "@modules/landing-variants/variant-17";
import { LandingVariant18 } from "@modules/landing-variants/variant-18";
import { LandingVariant19 } from "@modules/landing-variants/variant-19";
import { LandingVariant20 } from "@modules/landing-variants/variant-20";

export const dynamicParams = false;

const variants = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
] as const;
type LandingVariantId = (typeof variants)[number];

export async function generateStaticParams() {
  return variants.map((variant) => ({ variant }));
}

export default async function LandingVariantPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant: rawVariant } = await params;
  if (!variants.includes(rawVariant as LandingVariantId)) {
    notFound();
  }

  const variant = rawVariant as LandingVariantId;
  const locale = i18nConfig.defaultLocale;
  const { messages, t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  const hasPreviewConfig =
    Boolean(process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE) && Boolean(process.env.TRY_NOW_TOKEN);

  const content = landingContent.expansion;
  const supportedLanguages = SUPPORTED_LANGUAGES_STATIC;

  const common = {
    locale,
    messages,
    t,
    content,
    supportedLanguages,
    hasPreviewConfig,
  } as const;

  switch (variant) {
    case "1":
      return <LandingVariant1 {...common} />;
    case "2":
      return <LandingVariant2 {...common} />;
    case "3":
      return <LandingVariant3 {...common} />;
    case "4":
      return <LandingVariant4 {...common} />;
    case "5":
      return <LandingVariant5 {...common} />;
    case "6":
      return <LandingVariant6 {...common} />;
    case "7":
      return <LandingVariant7 {...common} />;
    case "8":
      return <LandingVariant8 {...common} />;
    case "9":
      return <LandingVariant9 {...common} />;
    case "10":
      return <LandingVariant10 {...common} />;
    case "11":
      return <LandingVariant11 {...common} />;
    case "12":
      return <LandingVariant12 {...common} />;
    case "13":
      return <LandingVariant13 {...common} />;
    case "14":
      return <LandingVariant14 {...common} />;
    case "15":
      return <LandingVariant15 {...common} />;
    case "16":
      return <LandingVariant16 {...common} />;
    case "17":
      return <LandingVariant17 {...common} />;
    case "18":
      return <LandingVariant18 {...common} />;
    case "19":
      return <LandingVariant19 {...common} />;
    case "20":
      return <LandingVariant20 {...common} />;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const { variant: rawVariant } = await params;
  if (!variants.includes(rawVariant as LandingVariantId)) {
    return {};
  }

  const locale = i18nConfig.defaultLocale;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const content = landingContent.expansion;

  return {
    title: t(content.metadata.titleKey, content.metadata.titleFallback),
    description: t(content.metadata.descriptionKey, content.metadata.descriptionFallback),
    robots: {
      index: false,
      follow: false,
    },
  };
}
