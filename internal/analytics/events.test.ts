import { describe, expect, it } from "vitest";

import {
  buildPreviewAnalyticsProperties,
  extractPublicUrlContext,
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
});
