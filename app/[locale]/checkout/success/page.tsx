import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resolveLocaleTranslator } from "@internal/i18n";

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await resolveLocaleTranslator(params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sessionId =
    typeof resolvedSearchParams?.session_id === "string"
      ? resolvedSearchParams.session_id
      : undefined;
  const maskedSessionId = sessionId ? `${sessionId.slice(0, 6)}…${sessionId.slice(-4)}` : undefined;

  return (
    <div className="bg-background py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <span className="text-sm uppercase tracking-[0.3em] text-primary">
          {t("checkout.success.tagline")}
        </span>
        <h1 className="text-4xl font-semibold text-foreground">{t("checkout.success.title")}</h1>
        <p className="text-base text-muted-foreground">{t("checkout.success.description")}</p>
        {maskedSessionId ? (
          <p className="rounded-full border border-primary/40 px-4 py-2 text-xs text-primary">
            {t("checkout.success.session", undefined, { id: maskedSessionId })}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Button asChild variant="outline" size="lg">
            <Link href={`/${locale}`}>{t("checkout.success.backHome")}</Link>
          </Button>
          <Button asChild size="lg">
            <Link href={`/${locale}/pricing`}>{t("checkout.success.reviewPricing")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Checkout Success",
    robots: { index: false, follow: false },
  };
}
