import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

import { submitContactMessage } from "./actions";

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const submitted = resolvedSearchParams?.submitted === "1";
  const errorParam =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined;
  const hasError = errorParam === "server" || errorParam === "invalid";
  const action = submitContactMessage.bind(null, locale);

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
        {(submitted || hasError) && (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              submitted
                ? "border-primary bg-primary/10 text-primary"
                : "border-destructive bg-destructive/10 text-destructive"
            }`}
          >
            {submitted ? t("contact.form.success") : t("contact.form.error")}
          </p>
        )}
        <form
          className="grid gap-6 rounded-3xl border border-border bg-card p-10 shadow-sm md:grid-cols-2"
          action={action}
        >
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.fullName")}
            <Input type="text" name="fullName" required />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.workEmail")}
            <Input type="email" name="workEmail" required />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.domain")}
            <Input type="url" name="domain" placeholder={t("contact.form.domain.placeholder")} />
          </label>
          <label className="flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.locales")}
            <Input type="text" name="locales" placeholder={t("contact.form.locales.placeholder")} />
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-foreground">
            {t("contact.form.message")}
            <textarea
              rows={4}
              className="rounded-md border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              name="message"
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
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }
  return createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: "contact.header.title",
    descriptionKey: "contact.header.description",
    titleFallback: "Contact",
    descriptionFallback: "Questions about pricing, security, or rollouts? Contact WebLingo.",
  });
}
