import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { i18nConfig, normalizeLocale } from "@internal/i18n";
import { landingSegments, type LandingSegment } from "@modules/landing/content";
import { LandingSegmentPage, getLandingSegmentMetadata } from "@modules/landing/segment-page";

export const dynamicParams = false;

export async function generateStaticParams() {
  return i18nConfig.locales.flatMap((locale) =>
    landingSegments.map((segment) => ({ locale, segment })),
  );
}

export default async function LandingSegmentRoute({
  params,
}: {
  params: Promise<{ locale: string; segment: string }>;
}) {
  const { locale: rawLocale, segment: rawSegment } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  if (!landingSegments.includes(rawSegment as LandingSegment)) {
    notFound();
  }

  const segment = rawSegment as LandingSegment;
  return <LandingSegmentPage locale={locale} segment={segment} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; segment: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, segment: rawSegment } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  if (!landingSegments.includes(rawSegment as LandingSegment)) {
    return {};
  }

  const segment = rawSegment as LandingSegment;
  return getLandingSegmentMetadata({ locale, segment, noIndex: true });
}
