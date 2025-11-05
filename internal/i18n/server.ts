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

export async function getMessages(locale: string): Promise<Messages> {
  const normalized = normalizeLocale(locale);
  return loaders[normalized]();
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
