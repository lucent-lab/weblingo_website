import { describe, expect, it } from "vitest";

import enMessagesJson from "../internal/i18n/messages/en.json";

const enMessages = enMessagesJson as Record<string, string>;

const publicMarketingPrefixes = [
  "nav.",
  "footer.",
  "home.",
  "landing.",
  "try.",
  "pricing.",
  "contact.",
  "banner.",
  "checkout.",
] as const;

const blockedLaunchPhrases = [
  "AI translation, human proof",
  "human proof",
  "Human-reviewed translations",
  "WebLingo is almost ready",
  "Final boarding call",
  "free-month code",
  "Free hosting included",
  "Cancel anytime",
  "No traffic quotas",
  "No traffic or bandwidth quotas",
  "Daily auto-crawl",
  "stays in sync automatically",
  "stay in sync automatically",
  "Business rollout",
  "Includes 10 client websites",
  "10 client websites",
  "10 client sites",
  "Notify me",
  "Generate preview",
  "Try your URL now",
] as const;

function publicMarketingEntries() {
  return Object.entries(enMessages).filter(([key]) =>
    publicMarketingPrefixes.some((prefix) => key.startsWith(prefix)),
  );
}

describe("launch landing copy", () => {
  it("keeps required launch CTAs consistent", () => {
    expect(enMessages["nav.try"]).toBe("Generate a private preview");
    expect(enMessages["try.form.button"]).toBe("Generate a private preview");
    expect(enMessages["landing.expansion.cta.primary"]).toBe("Generate a private preview");
    expect(enMessages["pricing.free.cta"]).toBe("Generate a private preview");
    expect(enMessages["pricing.final.cta"]).toBe("Generate a private preview");

    expect(enMessages["landing.expansion.cta.secondary"]).toBe("Talk through a rollout");
    expect(enMessages["pricing.header.contactCta"]).toBe("Talk through a rollout");
    expect(enMessages["contact.form.submit"]).toBe("Talk through a rollout");
    expect(enMessages["checkout.cancel.contact"]).toBe("Talk through a rollout");
  });

  it("blocks superseded launch, pricing, and managed-rollout claims", () => {
    for (const [key, value] of publicMarketingEntries()) {
      for (const blockedPhrase of blockedLaunchPhrases) {
        expect(value, key).not.toContain(blockedPhrase);
      }
      expect(value, key).not.toMatch(/\b0(?:\+|%)/);
    }
  });
});
