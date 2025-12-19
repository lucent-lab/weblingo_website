export function normalizeLangTag(input: string): string | null {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }
  const parts = normalized
    .split("-")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.length) {
    return null;
  }
  const formatted = parts.map((part, index) => {
    if (index === 0) {
      return part.toLowerCase();
    }
    if (/^[A-Za-z]{4}$/.test(part)) {
      return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
    }
    if (/^[A-Za-z]{2}$/.test(part) || /^[A-Za-z]{3}$/.test(part)) {
      return part.toUpperCase();
    }
    if (/^[0-9]{3}$/.test(part)) {
      return part;
    }
    return part.toLowerCase();
  });
  return formatted.join("-");
}
