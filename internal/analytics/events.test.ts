import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  ANALYTICS_EVENTS,
  AnalyticsPropertyValidationError,
  BACKEND_PRODUCED_ANALYTICS_EVENTS,
  assertSafeAnalyticsProperties,
  buildCtaAnalyticsProperties,
  buildPageAnalyticsProperties,
  buildPreviewAnalyticsProperties,
  extractLinkTargetContext,
  extractPublicUrlContext,
  isAnalyticsEventName,
  sanitizeAnalyticsProperties,
} from "./events";

describe("analytics events helpers", () => {
  it("extracts a public source host and path without query strings", () => {
    expect(
      extractPublicUrlContext("https://Example.COM/docs/getting-started?email=a@example.com#intro"),
    ).toEqual({
      sourceHost: "example.com",
      sourcePath: "/docs/getting-started",
    });
  });

  it("drops invalid URLs safely", () => {
    expect(extractPublicUrlContext("not a valid url")).toEqual({
      sourceHost: null,
      sourcePath: null,
    });
    expect(extractPublicUrlContext("mailto:alice@example.com")).toEqual({
      sourceHost: null,
      sourcePath: null,
    });
    expect(extractPublicUrlContext("file:///Users/example/Documents/secrets.txt")).toEqual({
      sourceHost: null,
      sourcePath: null,
    });
  });

  it("removes undefined fields from analytics payloads", () => {
    expect(
      sanitizeAnalyticsProperties({
        locale: "en",
        stage: undefined,
        status: "processing",
      }),
    ).toEqual({
      locale: "en",
      status: "processing",
    });
  });

  it("recognizes only declared analytics event names", () => {
    expect(isAnalyticsEventName("domain_provision_pending")).toBe(true);
    expect(isAnalyticsEventName("provider_payload")).toBe(false);
    expect(isAnalyticsEventName(null)).toBe(false);
  });

  it("keeps backend-produced events in one typed catalog list", () => {
    expect(BACKEND_PRODUCED_ANALYTICS_EVENTS).toContain(ANALYTICS_EVENTS.previewFeedbackSubmitted);
    expect(BACKEND_PRODUCED_ANALYTICS_EVENTS).toContain(
      ANALYTICS_EVENTS.dashboardVisibleFailuresViewed,
    );

    for (const eventName of BACKEND_PRODUCED_ANALYTICS_EVENTS) {
      expect(isAnalyticsEventName(eventName)).toBe(true);
    }
  });

  it("points backend analytics docs at the typed backend-produced event catalog", () => {
    const docs = readFileSync(new URL("../../docs/POSTHOG_ANALYTICS.md", import.meta.url), "utf8");

    expect(docs).toContain("BACKEND_PRODUCED_ANALYTICS_EVENTS");
    expect(docs).toContain("internal/analytics/events.ts");
    expect(docs).toContain("Do not restate that list in prose");
  });

  it("rejects forbidden raw analytics property names", () => {
    expect(() =>
      sanitizeAnalyticsProperties({
        email: "user@example.com",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        provider_payload: "{}",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        request_body: "{}",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        translated_text: "Bonjour",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
  });

  it("rejects unsafe analytics property values", () => {
    expect(() =>
      sanitizeAnalyticsProperties({
        source_path: "/pricing?email=user@example.com",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        source_host: "https://example.com/pricing?token=secret",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        error_code: "user@example.com",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
    expect(() =>
      sanitizeAnalyticsProperties({
        error_code: "token=secret",
      }),
    ).toThrow(AnalyticsPropertyValidationError);
  });

  it("allows explicit safe product metadata including host values", () => {
    expect(() =>
      assertSafeAnalyticsProperties({
        account_id: "acct_123",
        domain_host: "customer.example.com",
        domain_status: "verified",
        duration_ms: 42,
        replay_allowed: true,
        route_template: "/dashboard/sites/[id]/domains",
        site_id: "site_123",
        target_lang_count: 2,
      }),
    ).not.toThrow();
  });

  it("builds preview analytics properties without leaking full URLs", () => {
    expect(
      buildPreviewAnalyticsProperties({
        locale: "en",
        sourceUrl: "https://example.com/pricing?email=test@example.com",
        sourceLang: "en",
        targetLang: "fr",
        previewId: "preview-1",
        status: "processing",
        stage: "translating",
        retryHintReason: "browser_capacity_exhausted",
      }),
    ).toEqual({
      locale: "en",
      source_host: "example.com",
      source_path: "/pricing",
      source_lang: "en",
      target_lang: "fr",
      preview_id: "preview-1",
      status: "processing",
      stage: "translating",
      retry_hint_reason: "browser_capacity_exhausted",
    });
  });

  it("extracts safe CTA target context for internal, anchor, external, and mailto links", () => {
    expect(extractLinkTargetContext("/fr/pricing?coupon=secret#plans")).toEqual({
      targetKind: "internal",
      targetHost: null,
      targetPath: "/fr/pricing#plans",
    });
    expect(extractLinkTargetContext("#try")).toEqual({
      targetKind: "anchor",
      targetHost: null,
      targetPath: "#try",
    });
    expect(extractLinkTargetContext("https://example.com/docs/start?email=a@example.com")).toEqual({
      targetKind: "external",
      targetHost: "example.com",
      targetPath: "/docs/start",
    });
    expect(extractLinkTargetContext("mailto:contact@weblingo.app")).toEqual({
      targetKind: "mailto",
      targetHost: null,
      targetPath: null,
    });
  });

  it("builds page analytics properties with normalized page data", () => {
    expect(
      buildPageAnalyticsProperties({
        locale: "ja",
        pagePath: "/ja/landing/expansion",
        pageType: "landing",
        segment: "expansion",
        variant: "expansion",
        sessionPresent: true,
      }),
    ).toEqual({
      locale: "ja",
      page_path: "/ja/landing/expansion",
      page_type: "landing",
      segment: "expansion",
      session_present: true,
      variant: "expansion",
    });
  });

  it("builds CTA analytics properties without leaking query strings or mailto addresses", () => {
    expect(
      buildCtaAnalyticsProperties({
        ctaId: "pricing_header_contact",
        locale: "en",
        pagePath: "/en/pricing",
        pageType: "pricing",
        planId: "enterprise",
        targetHref: "mailto:contact@weblingo.app",
      }),
    ).toEqual({
      cta_id: "pricing_header_contact",
      locale: "en",
      page_path: "/en/pricing",
      page_type: "pricing",
      plan_id: "enterprise",
      target_kind: "mailto",
    });
    expect(
      buildCtaAnalyticsProperties({
        ctaId: "pricing_free_plan_try_preview",
        locale: "en",
        pagePath: "/en/pricing",
        pageType: "pricing",
        targetHref: "/en/try?email=secret@example.com#panel",
      }),
    ).toEqual({
      cta_id: "pricing_free_plan_try_preview",
      locale: "en",
      page_path: "/en/pricing",
      page_type: "pricing",
      target_kind: "internal",
      target_path: "/en/try#panel",
    });
  });
});
