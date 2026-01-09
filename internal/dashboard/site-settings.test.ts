import { describe, expect, it } from "vitest";

import {
  REQUIRED_FIELDS_MESSAGE,
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  type SiteSettingsAccess,
  type SiteSettingsFeature,
  type HasCheck,
} from "./site-settings";

const createHas =
  (enabled: SiteSettingsFeature[]) =>
  (check: HasCheck): boolean => {
    if ("feature" in check) {
      return enabled.includes(check.feature);
    }
    if ("allFeatures" in check) {
      return check.allFeatures.every((feature) => enabled.includes(feature));
    }
    throw new Error(`Unsupported check in test: ${JSON.stringify(check)}`);
  };

function makeAccess(overrides: Partial<SiteSettingsAccess> = {}): SiteSettingsAccess {
  return {
    billingBlocked: false,
    canEditBasics: false,
    canEditLocales: false,
    canEditServingMode: false,
    canEditCrawlCaptureMode: false,
    canEditClientRuntime: false,
    canEditTranslatableAttributes: false,
    canEditProfile: false,
    ...overrides,
  };
}

describe("deriveSiteSettingsAccess", () => {
  it("disables editing when billing is blocked", () => {
    const access = deriveSiteSettingsAccess({
      has: createHas([
        "edit",
        "locale_update",
        "serve",
        "crawl_capture_mode",
        "client_runtime_toggle",
        "translatable_attributes",
      ]),
      mutationsAllowed: false,
    });
    expect(access.billingBlocked).toBe(true);
    expect(access.canEditBasics).toBe(false);
    expect(access.canEditLocales).toBe(false);
    expect(access.canEditServingMode).toBe(false);
    expect(access.canEditCrawlCaptureMode).toBe(false);
    expect(access.canEditClientRuntime).toBe(false);
    expect(access.canEditTranslatableAttributes).toBe(false);
  });

  it("enables section access per feature when billing is ok", () => {
    const access = deriveSiteSettingsAccess({
      has: createHas([
        "edit",
        "locale_update",
        "serve",
        "crawl_capture_mode",
        "client_runtime_toggle",
        "translatable_attributes",
      ]),
      mutationsAllowed: true,
    });
    expect(access.canEditBasics).toBe(true);
    expect(access.canEditLocales).toBe(true);
    expect(access.canEditServingMode).toBe(true);
    expect(access.canEditCrawlCaptureMode).toBe(true);
    expect(access.canEditClientRuntime).toBe(true);
    expect(access.canEditTranslatableAttributes).toBe(true);
  });
});

describe("buildSiteSettingsUpdatePayload", () => {
  it("requires basics when editing routing fields", () => {
    const formData = new FormData();
    formData.set("sourceUrl", "https://www.example.com");
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditBasics: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(REQUIRED_FIELDS_MESSAGE);
    }
  });

  it("blocks locale updates when not permitted", () => {
    const formData = new FormData();
    formData.append("targetLangs", "fr");
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/locale updates/i);
    }
  });

  it("parses client runtime toggle updates", () => {
    const formData = new FormData();
    formData.append("clientRuntimeEnabled", "false");
    const result = buildSiteSettingsUpdatePayload(
      formData,
      makeAccess({ canEditClientRuntime: true }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({ clientRuntimeEnabled: false });
    }
  });

  it("parses translatable attribute updates", () => {
    const formData = new FormData();
    formData.set("translatableAttributes", "data-tip, aria-label");
    const result = buildSiteSettingsUpdatePayload(
      formData,
      makeAccess({ canEditTranslatableAttributes: true }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({ translatableAttributes: ["data-tip", "aria-label"] });
    }
  });

  it("rejects translatable attributes that are not data- or aria-", () => {
    const formData = new FormData();
    formData.set("translatableAttributes", "data-tip, title");
    const result = buildSiteSettingsUpdatePayload(
      formData,
      makeAccess({ canEditTranslatableAttributes: true }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/data-\* and aria-\*/i);
    }
  });
});
