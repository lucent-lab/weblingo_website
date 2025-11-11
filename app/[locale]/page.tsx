import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

const howItWorksSteps = [1, 2, 3];
const benefitsCount = [1, 2, 3, 4, 5];
const planIds = ["starter", "pro", "agency"] as const;
const faqKeys = ["home.faq.q1", "home.faq.q2", "home.faq.q3", "home.faq.q4", "home.faq.q5"];

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

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
              <Link href={`/${locale}/try`}>{t("home.hero.cta.primary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/pricing`}>{t("home.hero.cta.secondary")}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("home.hero.trust")}</p>
        </div>
      </section>

      <section id="faq" className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-foreground">{t("home.problem.title")}</h2>
          <p className="text-base text-muted-foreground">{t("home.problem.description")}</p>
          <Card className="border-border">
            <CardContent className="space-y-4 p-8 text-left text-muted-foreground">
              <p>{t("home.problem.solution")}</p>
              <Button asChild variant="link" className="px-0 text-primary">
                <Link href={`/${locale}/docs#how-it-works`}>{t("home.problem.cta")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-muted py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6">
          <h2 className="text-3xl font-semibold text-foreground text-center">
            {t("home.howItWorks.title", "How it works")}
          </h2>
          <ol className="space-y-6">
            {howItWorksSteps.map((step) => (
              <li
                key={step}
                className="rounded-2xl border border-border bg-background p-6 shadow-sm"
              >
                <span className="text-sm font-semibold text-primary">
                  {t(`home.steps.${step}.title`)}
                </span>
                <p className="mt-3 text-base text-muted-foreground">
                  {t(`home.steps.${step}.description`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-foreground">{t("home.languages.title")}</h2>
          <p className="text-base text-muted-foreground">{t("home.languages.body")}</p>
          <div className="rounded-3xl border border-border bg-muted p-8 text-left shadow-sm">
            <p className="text-sm text-muted-foreground">{t("home.languages.supportedIntro")}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("home.languages.supportedExamples")}
            </p>
            <Button asChild variant="link" className="mt-4 px-0 text-primary">
              <Link href={`/${locale}/docs#languages`}>{t("home.languages.link")}</Link>
            </Button>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {t("home.languages.future")}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6">
          <h2 className="text-3xl font-semibold text-foreground text-center">
            {t("home.benefits.title", "Why WebLingo")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {benefitsCount.map((idx) => (
              <Card key={idx} className="border-border">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {t(`home.benefits.${idx}`)}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-foreground">{t("home.pricing.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("home.pricing.note")}</p>
          <div className="grid gap-6 md:grid-cols-3">
            {planIds.map((planId) => {
              const title = t(`home.pricing.rows.${planId}.title`);
              const price = t(`home.pricing.rows.${planId}.price`);
              const core = t(`home.pricing.rows.${planId}.core`);
              const highlightKeys = [1, 2, 3]
                .map((index) => `home.pricing.rows.${planId}.highlight${index}`)
                .map((key) => {
                  const text = t(key);
                  return text === key ? null : text;
                })
                .filter((text): text is string => Boolean(text));
              return (
                <Card key={planId} className="border-border text-left">
                  <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{price}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{core}</p>
                    {highlightKeys.length > 0 ? (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {highlightKeys.map((highlight) => (
                          <li key={highlight} className="rounded-xl bg-background px-3 py-2">
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href={`/${locale}/pricing`}>{t("home.pricing.cta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/pricing#compare`}>{t("pricing.compare.title")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 text-center">
          <p className="text-sm text-muted-foreground">{t("home.trust.placeholder")}</p>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
          <h2 className="text-3xl font-semibold text-foreground text-center">
            {t("home.faq.title", "FAQ")}
          </h2>
          <div className="space-y-6">
            {faqKeys.map((key) => (
              <Card key={key} className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-foreground">
                    {t(`${key}.question`)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t(`${key}.answer`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background pb-24 pt-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-3xl font-semibold text-foreground">{t("home.final.title")}</h2>
          <p className="text-base text-muted-foreground">{t("home.final.subtitle")}</p>
          <Button asChild size="lg">
            <Link href={`/${locale}/try`}>{t("home.final.cta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }
  return createLocalizedMetadata(Promise.resolve({ locale }), {
    titleKey: "home.hero.title",
    descriptionKey: "home.hero.description",
    titleFallback: "Automatic Website Translation & Hosting",
    descriptionFallback:
      "Translate and host your website automatically on 330+ Cloudflare locations. Keep content in sync and SEO-ready with localized metadata and hreflang. Launch in minutes — no code required.",
  });
}
