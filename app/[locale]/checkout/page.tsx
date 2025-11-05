import { notFound } from "next/navigation";

import { CheckoutForm } from "@components/checkout-form";
import { pricingTiers } from "@modules/pricing";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const planId =
    typeof resolvedSearchParams?.plan === "string" ? resolvedSearchParams.plan : undefined;
  const hasPlan = planId ? pricingTiers.some((plan) => plan.id === planId) : true;

  if (!hasPlan) {
    notFound();
  }

  return (
    <div className="bg-background py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            {t("checkout.header.tagline")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-foreground">
            {t("checkout.header.title")}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{t("checkout.header.description")}</p>
        </header>
        <CheckoutForm locale={locale} messages={messages} defaultPlanId={planId} />
      </div>
    </div>
  );
}
