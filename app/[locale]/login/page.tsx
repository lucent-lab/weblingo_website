import { Button } from "@/components/ui/button";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function LoginPlaceholder({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background pb-24 pt-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-semibold text-foreground">{t("login.title")}</h1>
        <p className="max-w-2xl text-base text-muted-foreground">{t("login.description")}</p>
        <Button variant="secondary" disabled>
          {t("login.cta")}
        </Button>
      </div>
    </div>
  );
}
