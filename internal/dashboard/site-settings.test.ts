import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_anon_key";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.weblingo.example/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";
  return null;
});

import {
  REQUIRED_FIELDS_MESSAGE,
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  requiresSourceUrlReactivation,
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
    canEditSpaRefresh: false,
    canEditTranslatableAttributes: false,
    canEditProfile: false,
    canEditWebhooks: false,
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
        "edit",
      ]),
      mutationsAllowed: false,
    });
    expect(access.billingBlocked).toBe(true);
    expect(access.canEditBasics).toBe(false);
    expect(access.canEditLocales).toBe(false);
    expect(access.canEditServingMode).toBe(false);
    expect(access.canEditCrawlCaptureMode).toBe(false);
    expect(access.canEditClientRuntime).toBe(false);
    expect(access.canEditSpaRefresh).toBe(false);
    expect(access.canEditTranslatableAttributes).toBe(false);
    expect(access.canEditWebhooks).toBe(false);
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
        "edit",
      ]),
      mutationsAllowed: true,
    });
    expect(access.canEditBasics).toBe(true);
    expect(access.canEditLocales).toBe(true);
    expect(access.canEditServingMode).toBe(true);
    expect(access.canEditCrawlCaptureMode).toBe(true);
    expect(access.canEditClientRuntime).toBe(true);
    expect(access.canEditSpaRefresh).toBe(true);
    expect(access.canEditTranslatableAttributes).toBe(true);
    expect(access.canEditWebhooks).toBe(true);
  });
});

describe("requiresSourceUrlReactivation", () => {
  it("returns true when the source URL changes on an active site", () => {
    expect(requiresSourceUrlReactivation({ siteStatus: "active", sourceUrlChanged: true })).toBe(
      true,
    );
  });

  it("returns false when the site is inactive or the URL does not change", () => {
    expect(requiresSourceUrlReactivation({ siteStatus: "inactive", sourceUrlChanged: true })).toBe(
      false,
    );
    expect(requiresSourceUrlReactivation({ siteStatus: "active", sourceUrlChanged: false })).toBe(
      false,
    );
  });
});

describe("buildSiteSettingsUpdatePayload", () => {
  it("builds source URL replacement payloads through the existing settings update flow", () => {
    const formData = new FormData();
    formData.set("sourceUrl", "https://www.new-example.com");
    formData.set("subdomainPattern", "https://{lang}.new-example.com");

    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditBasics: true }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        sourceUrl: "https://www.new-example.com",
        subdomainPattern: "https://{lang}.new-example.com",
      });
    }
  });

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
      makeAccess({ canEditClientRuntime: true, canEditSpaRefresh: true }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({ clientRuntimeEnabled: false });
    }
  });

  it("parses spa refresh toggle updates", () => {
    const formData = new FormData();
    formData.append("spaRefreshEnabled", "true");
    formData.set("spaRefreshMissingFallback", "globalOnly");
    formData.set("spaRefreshErrorFallback", "globalOnly");
    formData.set("spaRefreshEnableSectionScope", "false");
    const result = buildSiteSettingsUpdatePayload(
      formData,
      makeAccess({ canEditSpaRefresh: true }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        spaRefresh: {
          enabled: true,
          missingFallback: "globalOnly",
          errorFallback: "globalOnly",
          enableSectionScope: false,
        },
      });
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

  it("parses webhook settings and allows clearing the allowlist", () => {
    const formData = new FormData();
    formData.set("webhookUrl", "https://hooks.example.com/weblingo");
    formData.set("webhookSecret", "secret-123");
    formData.set("webhookEvents", JSON.stringify(["translation.completed", "translation.summary"]));
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditWebhooks: true }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        webhookUrl: "https://hooks.example.com/weblingo",
        webhookSecret: "secret-123",
        webhookEvents: ["translation.completed", "translation.summary"],
      });
    }
  });

  it("preserves the existing webhook secret when no new secret field is submitted", () => {
    const formData = new FormData();
    formData.set("webhookUrl", "https://hooks.example.com/weblingo");
    formData.set("webhookEvents", JSON.stringify(["translation.completed"]));
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditWebhooks: true }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        webhookUrl: "https://hooks.example.com/weblingo",
        webhookEvents: ["translation.completed"],
      });
      expect(result.payload).not.toHaveProperty("webhookSecret");
    }
  });

  it("rejects unrecognized webhook events when parsing updates", () => {
    const formData = new FormData();
    formData.set("webhookUrl", "https://hooks.example.com/weblingo");
    formData.set("webhookSecret", "secret-123");
    formData.set("webhookEvents", JSON.stringify(["translation.completed", "translation.beta"]));
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditWebhooks: true }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unsupported event/i);
    }
  });

  it("treats an empty webhook allowlist as explicit disable", () => {
    const formData = new FormData();
    formData.set("webhookUrl", "https://hooks.example.com/weblingo");
    formData.set("webhookSecret", "secret-123");
    formData.set("webhookEvents", JSON.stringify([]));
    const result = buildSiteSettingsUpdatePayload(formData, makeAccess({ canEditWebhooks: true }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.webhookEvents).toEqual([]);
    }
  });
});
