import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REQUIRED_DOC_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_WEBHOOKS_API_BASE",
  "NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS",
  "HOME_PAGE_VARIANT",
  "PUBLIC_PORTAL_MODE",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICING_TABLE_ID",
  "STRIPE_PRICING_TABLE_ID_EN",
  "STRIPE_PRICING_TABLE_ID_FR",
  "STRIPE_PRICING_TABLE_ID_JA",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_AUTH_TIMEOUT_MS",
  "TRY_NOW_TOKEN",
  "WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS",
  "WEBSITE_WAITLIST_MAX_PER_WINDOW",
  "WEBSITE_WAITLIST_MAX_BODY_BYTES",
  "WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS",
  "WEBSITE_CONTACT_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS",
  "WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW",
  "WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_MAX_BODY_BYTES",
  "WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS",
  "WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS",
  "WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS",
  "UPSTASH_REDIS__KV_REST_API_URL",
  "UPSTASH_REDIS__KV_REST_API_TOKEN",
] as const;

const REQUIRED_CI_KEYS = [
  "HOME_PAGE_VARIANT",
  "PUBLIC_PORTAL_MODE",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_AUTH_TIMEOUT_MS",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_WEBHOOKS_API_BASE",
  "NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS",
  "WEBSITE_CONTACT_MAX_PER_WINDOW",
  "WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS",
  "WEBSITE_WAITLIST_MAX_BODY_BYTES",
  "WEBSITE_WAITLIST_MAX_PER_WINDOW",
  "WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS",
  "UPSTASH_REDIS__KV_REST_API_TOKEN",
  "UPSTASH_REDIS__KV_REST_API_URL",
] as const;

const PREVIEW_KEYS = [
  "WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS",
  "WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW",
  "WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW",
  "WEBSITE_PREVIEW_MAX_BODY_BYTES",
  "WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS",
  "WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS",
  "WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS",
] as const;

const BANNED_ALIAS_KEYS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS__KV_URL",
  "UPSTASH_REDIS__REDIS_URL",
  "UPSTASH_REDIS__KV_REST_API_READ_ONLY_TOKEN",
] as const;

describe("docs env contract", () => {
  const readme = readUtf8("README.md");
  const agents = readUtf8("AGENTS.md");
  const envExample = readUtf8(".env.example");
  const ciWorkflow = readUtf8(".github/workflows/ci.yml");
  const docsCorpus = `${readme}\n${agents}\n${envExample}`;

  it("documents canonical env keys used by runtime schemas", () => {
    for (const key of REQUIRED_DOC_KEYS) {
      expect(docsCorpus).toContain(key);
    }
  });

  it("keeps TRY_NOW_TOKEN preview requirements explicit in docs", () => {
    expect(docsCorpus).toContain("required when TRY_NOW_TOKEN is set");
    for (const key of PREVIEW_KEYS) {
      expect(docsCorpus).toContain(key);
    }
  });

  it("keeps CI env placeholders aligned with canonical keys", () => {
    for (const key of REQUIRED_CI_KEYS) {
      expect(ciWorkflow).toContain(`${key}:`);
    }
  });

  it("rejects non-canonical env aliases in docs/examples/ci", () => {
    const allText = `${docsCorpus}\n${ciWorkflow}`;
    for (const key of BANNED_ALIAS_KEYS) {
      const regex = new RegExp(`(?<![A-Z0-9_])${escapeRegExp(key)}(?![A-Z0-9_])`);
      expect(regex.test(allText)).toBe(false);
    }
  });
});
