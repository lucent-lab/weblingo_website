import type { Metadata } from "next";

import { i18nConfig, type Locale } from "./config";

export type Messages = Record<string, string>;

const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("./messages/en.json").then((mod) => mod.default as Messages),
  fr: () => import("./messages/fr.json").then((mod) => mod.default as Messages),
  ja: () => import("./messages/ja.json").then((mod) => mod.default as Messages),
};

export function normalizeLocale(locale: string): Locale {
  if (i18nConfig.locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return i18nConfig.defaultLocale;
}

const cache: Partial<Record<Locale, Messages>> = {};

async function loadMessages(locale: Locale): Promise<Messages> {
  if (!cache[locale]) {
    cache[locale] = await loaders[locale]();
  }
  return cache[locale]!;
}

let validated = false;

async function ensureMessageConsistency(): Promise<void> {
  if (validated) {
    return;
  }

  const locales = Object.keys(loaders) as Locale[];
  const referenceLocale = i18nConfig.defaultLocale;
  const referenceMessages = await loadMessages(referenceLocale);
  const referenceKeys = new Set(Object.keys(referenceMessages));

  const missingReports: string[] = [];
  const extraReports: string[] = [];

  for (const locale of locales) {
    const messages = locale === referenceLocale ? referenceMessages : await loadMessages(locale);
    const messageKeys = new Set(Object.keys(messages));

    const missing = [...referenceKeys].filter((key) => !messageKeys.has(key));
    if (missing.length > 0) {
      missingReports.push(`${locale}: ${missing.join(", ")}`);
    }

    const extra = [...messageKeys].filter((key) => !referenceKeys.has(key));
    if (extra.length > 0) {
      extraReports.push(`${locale}: ${extra.join(", ")}`);
    }
  }

  if (missingReports.length > 0 || extraReports.length > 0) {
    const parts = [
      "i18n message key mismatch detected.",
      missingReports.length ? `Missing keys -> ${missingReports.join(" | ")}` : null,
      extraReports.length ? `Extra keys -> ${extraReports.join(" | ")}` : null,
    ].filter(Boolean);

    throw new Error(parts.join(" "));
  }

  validated = true;
}

export async function getMessages(locale: string): Promise<Messages> {
  const normalized = normalizeLocale(locale);
  await ensureMessageConsistency();
  return loadMessages(normalized);
}

export type Translator = (key: string, fallback?: string, vars?: Record<string, string>) => string;

export function createTranslator(messages: Messages): Translator {
  return (key, fallback, vars) => {
    const template = messages[key] ?? fallback ?? key;
    if (!vars) return template;
    return Object.entries(vars).reduce(
      (acc, [varKey, value]) => acc.replace(new RegExp(`{${varKey}}`, "g"), value),
      template,
    );
  };
}

type LocaleParams = {
  locale: string;
};

type LocalizedMetadataOptions = {
  titleKey?: string;
  descriptionKey?: string;
  titleFallback: string;
  descriptionFallback: string;
};

export async function resolveLocaleTranslator(paramsPromise: Promise<LocaleParams>) {
  const { locale } = await paramsPromise;
  const messages = await getMessages(locale);
  const t = createTranslator(messages);
  return { locale, messages, t };
}

export async function createLocalizedMetadata(
  paramsPromise: Promise<LocaleParams>,
  { titleKey, descriptionKey, titleFallback, descriptionFallback }: LocalizedMetadataOptions,
): Promise<Metadata> {
  const { t } = await resolveLocaleTranslator(paramsPromise);

  const title = titleKey ? t(titleKey, titleFallback) : titleFallback;
  const description = descriptionKey ? t(descriptionKey, descriptionFallback) : descriptionFallback;

  return { title, description };
}
