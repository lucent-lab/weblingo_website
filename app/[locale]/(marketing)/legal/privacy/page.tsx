import type { Metadata } from "next";

import { createTranslator, getMessages } from "@internal/i18n";

const sections = [
  {
    titleKey: "legal.privacy.sections.controller.title",
    bodyKey: "legal.privacy.sections.controller.body",
    listKey: "legal.privacy.sections.controller.list",
  },
  {
    titleKey: "legal.privacy.sections.collect.title",
    bodyKey: "legal.privacy.sections.collect.body",
    listKey: "legal.privacy.sections.collect.list",
  },
  {
    titleKey: "legal.privacy.sections.analytics.title",
    bodyKey: "legal.privacy.sections.analytics.body",
  },
  {
    titleKey: "legal.privacy.sections.storage.title",
    bodyKey: "legal.privacy.sections.storage.body",
  },
  {
    titleKey: "legal.privacy.sections.rights.title",
    bodyKey: "legal.privacy.sections.rights.body",
  },
  {
    titleKey: "legal.privacy.sections.legalBasis.title",
    bodyKey: "legal.privacy.sections.legalBasis.body",
  },
  {
    titleKey: "legal.privacy.sections.retention.title",
    bodyKey: "legal.privacy.sections.retention.body",
  },
  {
    titleKey: "legal.privacy.sections.updates.title",
    bodyKey: "legal.privacy.sections.updates.body",
  },
];

const PRIVACY_POLICY_LAST_UPDATED = new Date("2025-11-05");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return {
    title: t("legal.privacy.title"),
    description: t("legal.privacy.sections.collect.body"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  const canonicalNotice = t("legal.common.canonicalNotice");

  const renderParagraphs = (text: string) =>
    text
      .split("\n\n")
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => (
        <p
          key={index}
          className={`${index === 0 ? "" : "mt-3"} text-sm leading-relaxed text-slate-600`}
        >
          {paragraph}
        </p>
      ));

  const renderList = (text?: string) => {
    if (!text) {
      return null;
    }
    const items = text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) {
      return null;
    }
    return (
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-white py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-600">
            {t("footer.privacy")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">{t("legal.privacy.title")}</h1>
          <p className="mt-3 text-base text-slate-600">
            {t("legal.privacy.updated", undefined, {
              date: PRIVACY_POLICY_LAST_UPDATED.toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            })}
          </p>
          <p className="mt-3 text-xs text-slate-500">{canonicalNotice}</p>
        </header>
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          {sections.map((section) => {
            const body = t(section.bodyKey);
            const list = section.listKey ? t(section.listKey) : undefined;
            return (
              <section key={section.titleKey}>
                <h2 className="text-lg font-semibold text-emerald-600">{t(section.titleKey)}</h2>
                {renderParagraphs(body)}
                {renderList(list)}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
