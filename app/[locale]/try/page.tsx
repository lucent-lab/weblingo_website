import type { Metadata } from "next";

import { TryForm } from "@/components/try-form";
import { createLocalizedMetadata, resolveLocaleTranslator } from "@internal/i18n";

export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, messages, t } = await resolveLocaleTranslator(params);

  return (
    <div className="bg-background pb-24 pt-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            {t("try.header.tagline")}
          </p>
          <h1 className="text-4xl font-semibold text-foreground">{t("try.header.title")}</h1>
          <p className="text-base text-muted-foreground">{t("try.header.description")}</p>
        </div>
        <p className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          {t("try.disabled.notice")}
        </p>
        <TryForm locale={locale} messages={messages} disabled />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return createLocalizedMetadata(params, {
    titleKey: "try.header.title",
    descriptionKey: "try.header.description",
    titleFallback: "Try Your URL",
    descriptionFallback:
      "Preview a translated version of your website and see how it would look hosted globally.",
  });
}
