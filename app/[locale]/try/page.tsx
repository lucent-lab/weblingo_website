import { TryForm } from "@/components/try-form";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
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
