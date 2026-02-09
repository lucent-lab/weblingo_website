import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { envServer } from "@internal/core";
import { normalizeLocale } from "@internal/i18n";
import { ClassicHomePage, getClassicHomeMetadata } from "@modules/home/classic-home";
import { LandingSegmentPage, getLandingSegmentMetadata } from "@modules/landing/segment-page";

const expansionSegment = "expansion" as const;

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  if (envServer.HOME_PAGE_VARIANT === "expansion") {
    return <LandingSegmentPage locale={locale} segment={expansionSegment} />;
  }

  return <ClassicHomePage locale={locale} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  if (envServer.HOME_PAGE_VARIANT === "expansion") {
    return getLandingSegmentMetadata({ locale, segment: expansionSegment });
  }

  return getClassicHomeMetadata({ locale });
}
