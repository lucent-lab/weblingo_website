export type LanguageNameResolver = (
  tag: string,
  options?: { fallbackEnglishName?: string | null },
) => string;

const DISPLAY_TAG_OVERRIDES: Record<string, string> = {
  // Prefer script-specific tags for clearer display names (keeps canonical tag unchanged).
  zh: "zh-Hans-CN",
  "zh-HK": "zh-Hant-HK",
  "zh-TW": "zh-Hant-TW",
};

export function createLanguageNameResolver(displayLocale: string): LanguageNameResolver {
  const locale = displayLocale.trim() || "en";

  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames =
      typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames([locale], { type: "language" })
        : null;
  } catch {
    displayNames = null;
  }

  return (tag, options) => {
    const normalized = tag.trim();
    if (!normalized) {
      return "";
    }

    try {
      const displayTag = DISPLAY_TAG_OVERRIDES[normalized] ?? normalized;
      const resolved = displayNames?.of(displayTag);
      if (typeof resolved === "string" && resolved.trim()) {
        return resolved;
      }
    } catch {
      // ignore lookup failures and fall back below
    }

    const fallback =
      typeof options?.fallbackEnglishName === "string" && options.fallbackEnglishName.trim()
        ? options.fallbackEnglishName.trim()
        : null;

    return fallback ?? normalized;
  };
}
