import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BarChart3, Cloud, Globe, Lock, RefreshCcw, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createLocalizedMetadata, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

const howItWorksSteps = [1, 2, 3];
const benefitCardIndexes = [1, 2, 4];
const benefitIcons = [Globe, Lock, RefreshCcw] as const;

function splitBenefit(text: string) {
  const separators = [" — ", " —", "—", " - "];
  for (const separator of separators) {
    const index = text.indexOf(separator);
    if (index !== -1) {
      return {
        title: text.slice(0, index).trim(),
        description: text.slice(index + separator.length).trim(),
      };
    }
  }
  return { title: text, description: "" };
}

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  const featureCards = [
    {
      title: t("home.features.ai.title"),
      description: t("home.features.ai.description"),
      icon: Zap,
    },
    {
      title: t("home.features.sync.title"),
      description: t("home.features.sync.description"),
      icon: Cloud,
    },
    {
      title: t("home.features.seo.title"),
      description: t("home.features.seo.description"),
      icon: BarChart3,
    },
    ...benefitCardIndexes.map((index, idx) => {
      const benefit = splitBenefit(t(`home.benefits.${index}`));
      const Icon = benefitIcons[idx] ?? Globe;
      return {
        title: benefit.title,
        description: benefit.description || benefit.title,
        icon: Icon,
      };
    }),
  ];

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-48">
        <div className="absolute inset-0 hero-pattern hero-gradient -z-10" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-block rounded-full border border-border bg-secondary px-4 py-2">
            <span className="text-sm font-medium text-secondary-foreground">
              {t("home.hero.tagline")}
            </span>
          </div>
          <h1 className="mb-8 text-5xl font-bold leading-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
            {t("home.hero.title")}
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-balance text-xl text-muted-foreground leading-relaxed">
            {t("home.hero.description")}
          </p>
          <div className="mb-12 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href={`/${locale}/try`}>
                {t("home.hero.cta.primary")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/pricing`}>{t("home.hero.cta.secondary")}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("home.hero.trust")}</p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t("home.problem.title")}
          </h2>
          <p className="mb-12 text-lg text-muted-foreground">
            {t("home.problem.description")}
          </p>
          <div className="rounded-lg border border-border bg-card p-8">
            <p className="mb-6 text-foreground">{t("home.problem.solution")}</p>
            <Link
              href={`/${locale}#how-it-works`}
              className="inline-flex items-center gap-2 font-medium text-primary transition hover:text-primary/80"
            >
              {t("home.problem.cta")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t("home.benefits.title", "Why WebLingo")}
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-muted-foreground">
            {t("home.languages.body")}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {featureCards.map((feature, index) => (
              <div
                key={`${feature.title}-${index}`}
                className="rounded-lg border border-border bg-card p-6 transition hover:border-primary/50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-16 text-center text-3xl font-bold text-foreground sm:text-4xl">
            {t("home.howItWorks.title", "How it works")}
          </h2>
          <div className="space-y-8">
            {howItWorksSteps.map((step) => (
              <div key={step} className="flex gap-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                  {step}
                </div>
                <div className="pt-1">
                  <h3 className="mb-2 text-lg font-bold text-foreground">
                    {t(`home.steps.${step}.title`)}
                  </h3>
                  <p className="text-muted-foreground">{t(`home.steps.${step}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            {t("home.languages.title")}
          </h2>
          <p className="mb-8 text-muted-foreground">{t("home.languages.body")}</p>
          <p className="text-sm text-muted-foreground">{t("home.languages.supportedIntro")}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("home.languages.supportedExamples")}
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-6 text-4xl font-bold text-foreground sm:text-5xl">
            {t("home.final.title")}
          </h2>
          <p className="mb-12 text-lg text-muted-foreground">{t("home.final.subtitle")}</p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
            <Link href={`/${locale}/try`}>
              {t("home.final.cta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
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
    titleKey: "home.hero.title",
    descriptionKey: "home.hero.description",
    titleFallback: "Automatic Website Translation & Hosting",
    descriptionFallback:
      "Translate and host your website automatically on 330+ Cloudflare locations. Keep content in sync and SEO-ready with localized metadata and hreflang. Launch in minutes — no code required.",
  });
}
