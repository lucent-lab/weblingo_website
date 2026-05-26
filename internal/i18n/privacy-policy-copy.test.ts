import { describe, expect, it } from "vitest";

import enMessages from "./messages/en.json";
import frMessages from "./messages/fr.json";
import jaMessages from "./messages/ja.json";

const locales = [
  { code: "en", messages: enMessages },
  { code: "fr", messages: frMessages },
  { code: "ja", messages: jaMessages },
] as const;

describe("privacy policy analytics copy", () => {
  it.each(locales)("names PostHog and privacy-protected replay in $code", ({ messages }) => {
    const analytics = messages["legal.privacy.sections.analytics.body"];
    const retention = messages["legal.privacy.sections.retention.body"];

    expect(analytics).toContain("PostHog");
    expect(retention).toContain("30");
  });

  it.each(locales)(
    "does not keep outdated cookie or anonymized analytics claims in $code",
    ({ messages }) => {
      const copy = [
        messages["legal.privacy.sections.analytics.body"],
        messages["legal.privacy.sections.legalBasis.body"],
      ].join("\n");

      expect(copy).not.toMatch(/Cookies may be introduced later|Aucun cookie|現時点でCookie/);
      expect(copy).not.toMatch(
        /anonymized product analytics|statistiques produit anonymisées|匿名化されたプロダクト分析/,
      );
    },
  );
});
