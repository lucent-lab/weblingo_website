import type { Metadata } from "next";

import { createTranslator, getMessages } from "@internal/i18n";

const sections = [
  {
    titleKey: "legal.notice.sections.operator.title",
    listKey: "legal.notice.sections.operator.list",
  },
  {
    titleKey: "legal.notice.sections.hosting.title",
    bodyKey: "legal.notice.sections.hosting.body",
  },
  {
    titleKey: "legal.notice.sections.liability.title",
    bodyKey: "legal.notice.sections.liability.body",
  },
  {
    titleKey: "legal.notice.sections.law.title",
    bodyKey: "legal.notice.sections.law.body",
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);

  return {
    title: t("legal.notice.title"),
    description: t("legal.notice.description"),
  };
}

export default async function LegalNoticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  const canonicalNotice = t("legal.common.canonicalNotice");

  const renderParagraphs = (text?: string) =>
    (text ?? "")
      .split("\n\n")
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => (
        <p
          key={index}
          className={`${index === 0 ? "" : "mt-3"} text-sm leading-relaxed text-muted-foreground`}
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
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="bg-background pb-24 pt-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
        <header className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">{t("nav.legal")}</p>
          <h1 className="text-4xl font-semibold text-foreground">{t("legal.notice.title")}</h1>
          <p className="text-base text-muted-foreground">{t("legal.notice.description")}</p>
          <p className="text-xs text-muted-foreground">{canonicalNotice}</p>
        </header>
        <div className="rounded-3xl border border-border bg-white p-10 shadow-sm">
          <div className="space-y-6">
            {sections.map((section) => {
              const body = section.bodyKey ? t(section.bodyKey) : undefined;
              const list = section.listKey ? t(section.listKey) : undefined;
              return (
                <section key={section.titleKey}>
                  <h2 className="text-lg font-semibold text-primary">{t(section.titleKey)}</h2>
                  {renderParagraphs(body)}
                  {renderList(list)}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
