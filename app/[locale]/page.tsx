import Link from "next/link";

import { PricingTeaser } from "@/components/pricing-teaser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTranslator, getMessages } from "@internal/i18n";

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden pb-24 pt-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_65%)]" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 text-center">
          <Badge variant="secondary" className="mx-auto">
            {t("home.hero.tagline")}
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t("home.hero.title")}
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t("home.hero.description")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link href={`/${locale}/pricing`}>{t("home.hero.cta.primary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/docs`}>{t("home.hero.cta.secondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 md:grid-cols-3">
          {[
            {
              titleKey: "home.features.ai.title",
              descriptionKey: "home.features.ai.description",
            },
            {
              titleKey: "home.features.sync.title",
              descriptionKey: "home.features.sync.description",
            },
            {
              titleKey: "home.features.seo.title",
              descriptionKey: "home.features.seo.description",
            },
          ].map((feature) => (
            <Card key={feature.titleKey}>
              <CardHeader>
                <CardTitle>{t(feature.titleKey)}</CardTitle>
                <CardDescription>{t(feature.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent className="text-left text-sm text-muted-foreground">
                <p>{t("home.features.supporting", undefined, { feature: t(feature.titleKey) })}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <PricingTeaser locale={locale} t={t} />

      <section className="border-t border-border bg-background pb-24 pt-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-foreground">{t("home.cta.title")}</h2>
          <p className="text-base text-muted-foreground">{t("home.cta.description")}</p>
          <Button asChild size="lg">
            <Link href={`/${locale}/contact`}>{t("home.cta.button")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
