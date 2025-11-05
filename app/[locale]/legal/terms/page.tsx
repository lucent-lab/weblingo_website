import type { Metadata } from "next";

import { createTranslator, getMessages } from "@internal/i18n";

const sections = [
  {
    titleKey: "legal.terms.sections.overview.title",
    bodyKey: "legal.terms.sections.overview.body",
  },
  {
    titleKey: "legal.terms.sections.use.title",
    bodyKey: "legal.terms.sections.use.body",
  },
  {
    titleKey: "legal.terms.sections.billing.title",
    bodyKey: "legal.terms.sections.billing.body",
  },
  {
    titleKey: "legal.terms.sections.data.title",
    bodyKey: "legal.terms.sections.data.body",
  },
  {
    titleKey: "legal.terms.sections.liability.title",
    bodyKey: "legal.terms.sections.liability.body",
  },
];

const TERMS_OF_SERVICE_LAST_UPDATED = new Date("2025-11-05");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return {
    title: t("legal.terms.title"),
    description: t("legal.terms.sections.overview.body"),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return (
    <div className="bg-white py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">{t("nav.terms")}</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">{t("legal.terms.title")}</h1>
          <p className="mt-3 text-base text-slate-600">
            {t("legal.terms.updated", undefined, {
              date: TERMS_OF_SERVICE_LAST_UPDATED.toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          </p>
        </header>
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          {sections.map((section) => (
            <section key={section.titleKey}>
              <h2 className="text-lg font-semibold text-emerald-600">{t(section.titleKey)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(section.bodyKey)}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
