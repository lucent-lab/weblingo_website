import { normalizeLangTag } from "@internal/i18n";

export function parseSourceUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function stripWwwPrefix(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function extractSubdomainToken(
  pattern: string | null | undefined,
  sourceUrl: URL | null,
): string {
  if (!pattern || !pattern.includes("{lang}")) {
    return "{lang}";
  }
  const trimmedPattern = pattern.trim().replace(/^https?:\/\//i, "");
  const hostPart = trimmedPattern.split("/")[0] ?? "";
  if (!hostPart) {
    return "{lang}";
  }
  const baseHost = sourceUrl ? stripWwwPrefix(sourceUrl.hostname) : null;
  if (baseHost && hostPart.endsWith(`.${baseHost}`)) {
    const token = hostPart.slice(0, -(baseHost.length + 1));
    return token || "{lang}";
  }
  const firstLabel = hostPart.split(".")[0] ?? "";
  return firstLabel.includes("{lang}") ? firstLabel : "{lang}";
}

export function buildLocaleAliases(
  targetLangs: string[],
  aliasesByLang: Record<string, string>,
): Record<string, string | null> {
  const aliases: Record<string, string | null> = {};
  for (const lang of targetLangs) {
    const raw = aliasesByLang[lang];
    const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    aliases[lang] = normalized ? normalized : null;
  }
  return aliases;
}

export function suggestLocaleAlias(tag: string): string {
  const normalized = normalizeLangTag(tag) ?? tag.trim();
  const cleaned = normalized.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return cleaned || tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function validateLocaleAlias(value: string): string | null {
  if (!value) {
    return null;
  }
  if (value.length > 63) {
    return "Aliases must be 63 characters or fewer.";
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return "Aliases cannot start or end with a hyphen.";
  }
  if (!/^[a-z0-9-]+$/.test(value)) {
    return "Use lowercase letters, numbers, or hyphens.";
  }
  return null;
}

export function hasInvalidAliases(aliasesByLang: Record<string, string>): boolean {
  return Object.values(aliasesByLang).some((value) => validateLocaleAlias(value) !== null);
}
