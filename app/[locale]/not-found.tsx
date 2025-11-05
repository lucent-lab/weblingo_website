import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createTranslator, getMessages, i18nConfig, normalizeLocale } from "@internal/i18n";

type ParamsInput = { locale: string };

async function resolveParams(params?: Promise<ParamsInput> | ParamsInput) {
  if (!params) {
    return { locale: i18nConfig.defaultLocale };
  }

  if (params instanceof Promise) {
    const resolved = await params;
    return { locale: normalizeLocale(resolved?.locale ?? i18nConfig.defaultLocale) };
  }

  return { locale: normalizeLocale((params as ParamsInput)?.locale ?? i18nConfig.defaultLocale) };
}

export default async function LocaleNotFound({
  params,
}: {
  params?: Promise<ParamsInput> | ParamsInput;
}) {
  const { locale } = await resolveParams(params);
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-5xl font-semibold text-foreground">{t("notFound.title")}</h1>
        <p className="text-base text-muted-foreground">{t("notFound.description")}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href={`/${locale}`}>{t("notFound.backHome")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/pricing`}>{t("notFound.viewPricing")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
