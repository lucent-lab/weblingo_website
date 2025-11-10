export { i18nConfig, type Locale } from "./config";
export {
  getMessages,
  createTranslator,
  normalizeLocale,
  type Messages,
  type Translator,
  resolveLocaleTranslator,
  createLocalizedMetadata,
} from "./server";
export { createClientTranslator, type ClientMessages } from "./client";
