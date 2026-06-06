import { describe, expect, it } from "vitest";

import { clientEnvSchema } from "./env";

const validClientEnv = {
  NEXT_PUBLIC_APP_URL: "https://weblingo.app",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_BROWSER_HOST: "https://metrics.weblingo.app",
  NEXT_PUBLIC_POSTHOG_CAPTURE: "enabled",
  NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE: "sampled",
  NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: "0.05",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "supabase-key",
  NEXT_PUBLIC_WEBHOOKS_API_BASE: "https://api.weblingo.app",
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: "5000",
};

describe("client env schema", () => {
  it("keeps PostHog browser proxy and upstream ingestion hosts distinct", () => {
    expect(clientEnvSchema.safeParse(validClientEnv).success).toBe(true);

    expect(
      clientEnvSchema.safeParse({
        ...validClientEnv,
        NEXT_PUBLIC_POSTHOG_BROWSER_HOST: validClientEnv.NEXT_PUBLIC_POSTHOG_HOST,
      }).success,
    ).toBe(false);
  });

  it("rejects accidentally swapped PostHog managed proxy host roles", () => {
    expect(
      clientEnvSchema.safeParse({
        ...validClientEnv,
        NEXT_PUBLIC_POSTHOG_HOST: validClientEnv.NEXT_PUBLIC_POSTHOG_BROWSER_HOST,
      }).success,
    ).toBe(false);
  });

  it("requires explicit analytics kill switch and bounded replay sampling config", () => {
    expect(
      clientEnvSchema.safeParse({
        ...validClientEnv,
        NEXT_PUBLIC_POSTHOG_CAPTURE: "paused",
      }).success,
    ).toBe(false);
    expect(
      clientEnvSchema.safeParse({
        ...validClientEnv,
        NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: "1.5",
      }).success,
    ).toBe(false);
    expect(
      clientEnvSchema.safeParse({
        ...validClientEnv,
        NEXT_PUBLIC_POSTHOG_CAPTURE: "disabled",
        NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE: "disabled",
        NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: "0",
      }).success,
    ).toBe(true);
  });
});
