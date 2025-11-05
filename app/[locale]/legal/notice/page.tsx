import { createTranslator, getMessages } from "@internal/i18n";

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background pb-24 pt-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <header className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">{t("nav.legal")}</p>
          <h1 className="text-4xl font-semibold text-foreground">{t("legal.notice.title")}</h1>
          <p className="text-base text-muted-foreground">{t("legal.notice.description")}</p>
        </header>
      </div>
    </div>
  );
}
