export const WEBHOOK_EVENT_TYPES = [
  "translation.completed",
  "translation.failed",
  "translation.summary",
] as const;

export type KnownWebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export type NotifyWebhookEventType = KnownWebhookEventType;

export type SupportedLanguage = {
  tag: string;
  englishName: string;
  direction: "ltr" | "rtl";
};

export const SUPPORTED_LANGUAGES_STATIC: SupportedLanguage[] = [
  { tag: "ar", englishName: "Arabic", direction: "rtl" },
  { tag: "bg", englishName: "Bulgarian (Bulgaria)", direction: "ltr" },
  { tag: "cs", englishName: "Czech (Czech Republic)", direction: "ltr" },
  { tag: "da", englishName: "Danish (Denmark)", direction: "ltr" },
  { tag: "de", englishName: "German (Germany)", direction: "ltr" },
  { tag: "el", englishName: "Greek (Greece)", direction: "ltr" },
  { tag: "en", englishName: "English", direction: "ltr" },
  { tag: "en-GB", englishName: "English (United Kingdom)", direction: "ltr" },
  { tag: "es", englishName: "Spanish (Spain)", direction: "ltr" },
  { tag: "es-419", englishName: "Spanish (Latin America)", direction: "ltr" },
  { tag: "et", englishName: "Estonian (Estonia)", direction: "ltr" },
  { tag: "fi", englishName: "Finnish (Finland)", direction: "ltr" },
  { tag: "fil", englishName: "Filipino (Philippines)", direction: "ltr" },
  { tag: "fr", englishName: "French (France)", direction: "ltr" },
  { tag: "fr-CA", englishName: "French (Canada)", direction: "ltr" },
  { tag: "he", englishName: "Hebrew (Israel)", direction: "rtl" },
  { tag: "hr", englishName: "Croatian (Croatia)", direction: "ltr" },
  { tag: "hu", englishName: "Hungarian (Hungary)", direction: "ltr" },
  { tag: "id", englishName: "Indonesian (Indonesia)", direction: "ltr" },
  { tag: "it", englishName: "Italian (Italy)", direction: "ltr" },
  { tag: "ja", englishName: "Japanese (Japan)", direction: "ltr" },
  { tag: "ko", englishName: "Korean (Korea)", direction: "ltr" },
  { tag: "lt", englishName: "Lithuanian (Lithuania)", direction: "ltr" },
  { tag: "lv", englishName: "Latvian (Latvia)", direction: "ltr" },
  { tag: "ms", englishName: "Malay (Malaysia)", direction: "ltr" },
  { tag: "mt", englishName: "Maltese (Malta)", direction: "ltr" },
  { tag: "nb", englishName: "Norwegian Bokmål", direction: "ltr" },
  { tag: "nl", englishName: "Dutch (Netherlands)", direction: "ltr" },
  { tag: "pl", englishName: "Polish (Poland)", direction: "ltr" },
  { tag: "pt", englishName: "Portuguese", direction: "ltr" },
  { tag: "pt-BR", englishName: "Portuguese (Brazil)", direction: "ltr" },
  { tag: "ro", englishName: "Romanian (Romania)", direction: "ltr" },
  { tag: "ru", englishName: "Russian (Russia)", direction: "ltr" },
  { tag: "sk", englishName: "Slovak (Slovakia)", direction: "ltr" },
  { tag: "sl", englishName: "Slovenian (Slovenia)", direction: "ltr" },
  { tag: "sv", englishName: "Swedish (Sweden)", direction: "ltr" },
  { tag: "th", englishName: "Thai (Thailand)", direction: "ltr" },
  { tag: "tr", englishName: "Turkish (Turkey)", direction: "ltr" },
  { tag: "vi", englishName: "Vietnamese (Vietnam)", direction: "ltr" },
  { tag: "zh", englishName: "Chinese Simplified (China)", direction: "ltr" },
  { tag: "zh-HK", englishName: "Chinese Traditional (Hong Kong)", direction: "ltr" },
  { tag: "zh-TW", englishName: "Chinese Traditional (Taiwan)", direction: "ltr" },
];
