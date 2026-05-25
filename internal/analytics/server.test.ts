import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => {
  const shutdownPromises: Array<Promise<unknown> | undefined> = [];
  const instances: Array<{
    capture: ReturnType<typeof vi.fn>;
    captureException: ReturnType<typeof vi.fn>;
    shutdown: ReturnType<typeof vi.fn>;
  }> = [];

  const PostHog = vi.fn(function PostHog() {
    const instance = {
      capture: vi.fn(),
      captureException: vi.fn(),
      shutdown: vi.fn(() => shutdownPromises.shift() ?? Promise.resolve(undefined)),
    };
    instances.push(instance);
    return instance;
  });

  return { PostHog, instances, shutdownPromises };
});

vi.mock("posthog-node", () => ({ PostHog: posthogMock.PostHog }));

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";
}

beforeEach(() => {
  vi.resetModules();
  setRequiredEnv();
  posthogMock.PostHog.mockClear();
  posthogMock.instances.length = 0;
  posthogMock.shutdownPromises.length = 0;
});

describe("server analytics helpers", () => {
  it("captures sanitized server events and flushes before returning", async () => {
    const { captureServerAnalyticsEvent } = await import("./server");

    await captureServerAnalyticsEvent(
      "waitlist_signup_saved",
      {
        source_host: "example.com",
        source_path: undefined,
        site_url_present: true,
      },
      {
        distinctId: " user-1 ",
        groups: {
          account: " acct-1 ",
          blank: " ",
        },
      },
    );

    expect(posthogMock.PostHog).toHaveBeenCalledWith("phc_test", {
      host: "https://posthog.example.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3000,
      preloadFeatureFlags: false,
      disableGeoip: true,
    });
    expect(posthogMock.instances[0]?.capture).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "waitlist_signup_saved",
      groups: { account: "acct-1" },
      properties: {
        source_host: "example.com",
        site_url_present: true,
        runtime: "server",
      },
    });
    expect(posthogMock.instances[0]?.shutdown).toHaveBeenCalledWith(1000);
  });

  it("captures exceptions without leaking empty properties", async () => {
    const { captureServerException } = await import("./server");
    const error = new Error("secret sk_test_leak");

    await captureServerException(
      error,
      {
        source: "checkout",
        source_path: null,
      },
      {
        distinctId: null,
      },
    );

    const capturedError = posthogMock.instances[0]?.captureException.mock.calls[0]?.[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe("Server exception captured");
    expect(capturedError.name).toBe("ServerAnalyticsException");
    expect(capturedError.message).not.toContain("sk_test_leak");
    expect(posthogMock.instances[0]?.captureException).toHaveBeenCalledWith(
      capturedError,
      "server",
      {
        source: "checkout",
        error_name: "Error",
        runtime: "server",
      },
    );
    expect(posthogMock.instances[0]?.shutdown).toHaveBeenCalledWith(1000);
  });

  it("does not wait for PostHog shutdown before resolving", async () => {
    posthogMock.shutdownPromises.push(new Promise(() => undefined));
    const { captureServerAnalyticsEvent } = await import("./server");

    await expect(captureServerAnalyticsEvent("waitlist_signup_saved")).resolves.toBeUndefined();

    expect(posthogMock.instances[0]?.capture).toHaveBeenCalledOnce();
    expect(posthogMock.instances[0]?.shutdown).toHaveBeenCalledWith(1000);
  });

  it("hashes identifiers without retaining the raw value", async () => {
    const { hashAnalyticsIdentifier } = await import("./server");

    const hashed = hashAnalyticsIdentifier("stripe_session", "cs_live_sensitive");

    expect(hashed).toMatch(/^stripe_session:[a-f0-9]{20}$/);
    expect(hashed).not.toContain("cs_live_sensitive");
    expect(hashAnalyticsIdentifier("stripe_session", "")).toBeNull();
  });
});
