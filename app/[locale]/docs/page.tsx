import { createTranslator, getMessages } from "@internal/i18n";

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background pb-24 pt-20 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-semibold text-foreground">{t("docs.title")}</h1>
          <p className="text-base text-muted-foreground">{t("docs.overview")}</p>
        </header>
        <ol className="list-decimal space-y-3 pl-6 text-sm text-muted-foreground">
          <li>{t("docs.step.one")}</li>
          <li>{t("docs.step.two")}</li>
          <li>{t("docs.step.three")}</li>
          <li>{t("docs.step.four")}</li>
        </ol>
        <section className="rounded-2xl border border-border bg-muted p-6">
          <h2 className="text-lg font-semibold text-primary">{t("docs.cname.heading")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("docs.cname.description")}</p>
        </section>
      </div>
    </div>
  );
}
