import { notFound } from "next/navigation";

import { TryForm } from "@/components/try-form";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locale) {
    notFound();
  }

  let messages: Awaited<ReturnType<typeof getMessages>>;
  try {
    messages = await getMessages(locale);
  } catch (error) {
    console.error("Failed to load messages:", error);
    notFound();
  }
  const t = createTranslator(messages);

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
        <TryForm locale={locale} messages={messages} />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  return {
    title: t("try.header.title", "Try Your URL"),
    description: t(
      "try.header.description",
      "Preview a translated version of your website and see how it would look hosted globally.",
    ),
  };
}
import type { Metadata } from "next";
