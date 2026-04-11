import { describe, expect, it } from "vitest";

import {
  buildConsistencyLocaleScopes,
  formatConsistencyLocaleScopeLabel,
  selectConsistencyLocaleScope,
} from "./locale-scope";

describe("consistency locale scope helpers", () => {
  it("keeps distinct source-target pairs and selects exact query matches", () => {
    const scopes = buildConsistencyLocaleScopes([
      { sourceLang: "en", targetLang: "fr" },
      { sourceLang: "ja", targetLang: "fr" },
      { sourceLang: "en", targetLang: "fr" },
    ]);

    expect(scopes).toEqual([
      { sourceLang: "en", targetLang: "fr" },
      { sourceLang: "ja", targetLang: "fr" },
    ]);
    expect(formatConsistencyLocaleScopeLabel(scopes[1])).toBe("ja → fr");
    expect(selectConsistencyLocaleScope(scopes, { sourceLang: "ja", targetLang: "fr" })).toEqual({
      sourceLang: "ja",
      targetLang: "fr",
    });
  });

  it("falls back to the first scope when no query scope is provided", () => {
    const scopes = buildConsistencyLocaleScopes([
      { sourceLang: "en", targetLang: "fr" },
      { sourceLang: "ja", targetLang: "fr" },
    ]);

    expect(selectConsistencyLocaleScope(scopes)).toEqual({ sourceLang: "en", targetLang: "fr" });
    expect(selectConsistencyLocaleScope(scopes, { targetLang: "fr" })).toEqual({
      sourceLang: "en",
      targetLang: "fr",
    });
  });
});
