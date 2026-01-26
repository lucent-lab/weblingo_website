import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  return (
    <div className="bg-background py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <span className="text-sm uppercase tracking-[0.3em] text-primary">
          {t("checkout.cancel.tagline")}
        </span>
        <h1 className="text-4xl font-semibold text-foreground">{t("checkout.cancel.title")}</h1>
        <p className="text-base text-muted-foreground">{t("checkout.cancel.description")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href={`/${locale}/pricing`}>{t("checkout.cancel.backPricing")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/contact`}>{t("checkout.cancel.contact")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
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
  return {
    title: "Checkout Canceled",
    robots: { index: false, follow: false },
  };
}
