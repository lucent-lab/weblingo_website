import { describe, expect, it } from "vitest";

import { resolvePreferredLocale } from "./server";

describe("resolvePreferredLocale", () => {
  it("prefers the first supported language range", () => {
    expect(resolvePreferredLocale("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(resolvePreferredLocale("ja-JP,fr;q=0.9,en;q=0.8")).toBe("ja");
    expect(resolvePreferredLocale("pt-BR,fr;q=0.9,en;q=0.8")).toBe("fr");
  });

  it("falls back to the default locale for unsupported inputs", () => {
    expect(resolvePreferredLocale("de-DE,de;q=0.9,en;q=0.8")).toBe("en");
    expect(resolvePreferredLocale("")).toBe("en");
    expect(resolvePreferredLocale(null)).toBe("en");
  });
});
