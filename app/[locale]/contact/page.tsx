import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            {t("contact.header.tagline")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-foreground">
            {t("contact.header.title")}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{t("contact.header.description")}</p>
        </header>
        <form className="grid gap-6 rounded-3xl border border-border bg-card p-10 shadow-sm md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.fullName")}
            <Input type="text" required />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.workEmail")}
            <Input type="email" required />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.domain")}
            <Input type="url" placeholder={t("contact.form.domain.placeholder")} />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.locales")}
            <Input type="text" placeholder={t("contact.form.locales.placeholder")} />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.message")}
            <textarea
              rows={4}
              className="rounded-md border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
          <Button type="submit" size="lg" className="md:col-span-2 justify-center">
            {t("contact.form.submit")}
          </Button>
        </form>
        <section className="rounded-3xl border border-border bg-muted p-8 text-sm text-muted-foreground">
          <h2 className="text-lg font-semibold text-primary">{t("contact.direct.heading")}</h2>
          <p className="mt-3">{t("contact.direct.description")}</p>
        </section>
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
    title: t("contact.header.title", "Contact"),
    description: t(
      "contact.header.description",
      "Questions about pricing, security, or rollouts? Contact WebLingo.",
    ),
  };
}
import type { Metadata } from "next";
