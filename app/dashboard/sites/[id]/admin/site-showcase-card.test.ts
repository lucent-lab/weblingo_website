import { describe, expect, it } from "vitest";

import { buildShowcaseLocaleLinks } from "./showcase-locale-links";

describe("buildShowcaseLocaleLinks", () => {
  it("sorts the effective default locale first and builds one URL per unique locale", () => {
    expect(buildShowcaseLocaleLinks("weblingo.app", ["it", "fr", "it"], "it")).toEqual([
      {
        targetLang: "it",
        isDefault: true,
        url: "https://t2.weblingo.app/weblingo.app/it",
      },
      {
        targetLang: "fr",
        isDefault: false,
        url: "https://t2.weblingo.app/weblingo.app/fr",
      },
    ]);
  });
});
