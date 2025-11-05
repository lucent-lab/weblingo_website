export { i18nConfig, type Locale } from "./config";
export {
  getMessages,
  createTranslator,
  normalizeLocale,
  type Messages,
  type Translator,
} from "./server";
export { createClientTranslator, type ClientMessages } from "./client";
