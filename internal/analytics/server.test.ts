import { beforeEach, describe, expect, it, vi } from "vitest";

const nextServerMock = vi.hoisted(() => {
  const afterTasks: Array<() => unknown> = [];
  const after = vi.fn((task: () => unknown) => {
    afterTasks.push(task);
  });

  return { after, afterTasks };
});

const posthogMock = vi.hoisted(() => {
  const immediatePromises: Array<Promise<unknown> | undefined> = [];
  const instances: Array<{
    captureImmediate: ReturnType<typeof vi.fn>;
    capture: ReturnType<typeof vi.fn>;
    captureException: ReturnType<typeof vi.fn>;
    shutdown: ReturnType<typeof vi.fn>;
  }> = [];

  const PostHog = vi.fn(function PostHog() {
    const instance = {
      captureImmediate: vi.fn(() => immediatePromises.shift() ?? Promise.resolve(undefined)),
      capture: vi.fn(),
      captureException: vi.fn(),
      shutdown: vi.fn(),
    };
    instances.push(instance);
    return instance;
  });

  return { PostHog, instances, immediatePromises };
});

vi.mock("next/server", () => ({ after: nextServerMock.after }));
vi.mock("posthog-node", () => ({ PostHog: posthogMock.PostHog }));

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

async function runScheduledAfterTasks() {
  const tasks = nextServerMock.afterTasks.splice(0);
  await Promise.all(tasks.map(async (task) => task()));
}

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "http://localhost:3000/_analytics/posthog";
  process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "enabled";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "disabled";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "0";
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
  nextServerMock.afterTasks.length = 0;
  nextServerMock.after.mockReset();
  nextServerMock.after.mockImplementation((task: () => unknown) => {
    nextServerMock.afterTasks.push(task);
  });
  posthogMock.PostHog.mockClear();
  posthogMock.instances.length = 0;
  posthogMock.immediatePromises.length = 0;
});

describe("server analytics helpers", () => {
  it("schedules sanitized server events after the response and sends them immediately", async () => {
    const { captureServerAnalyticsEvent } = await import("./server");

    captureServerAnalyticsEvent(
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

    expect(nextServerMock.after).toHaveBeenCalledOnce();
    expect(posthogMock.PostHog).not.toHaveBeenCalled();

    await runScheduledAfterTasks();

    expect(posthogMock.PostHog).toHaveBeenCalledWith("phc_test", {
      host: "https://posthog.example.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 3000,
      preloadFeatureFlags: false,
      disableGeoip: true,
    });
    expect(posthogMock.instances[0]?.captureImmediate).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "waitlist_signup_saved",
      groups: { account: "acct-1" },
      properties: {
        app_surface: "marketing",
        deployment_channel: "test",
        environment: "test",
        repo: "weblingo_website",
        source_host: "example.com",
        site_url_present: true,
        runtime: "server",
      },
    });
    expect(posthogMock.instances[0]?.capture).not.toHaveBeenCalled();
    expect(posthogMock.instances[0]?.shutdown).not.toHaveBeenCalled();
  });

  it("captures exceptions as sanitized immediate exception events", async () => {
    const { captureServerException } = await import("./server");
    const error = new Error("secret sk_test_leak");

    captureServerException(
      error,
      {
        source: "checkout",
        source_path: null,
      },
      {
        distinctId: null,
      },
    );

    await runScheduledAfterTasks();

    const payload = posthogMock.instances[0]?.captureImmediate.mock.calls[0]?.[0] as
      | {
          distinctId: string;
          event: string;
          properties: Record<string, unknown>;
        }
      | undefined;

    expect(payload).toEqual({
      distinctId: "server",
      event: "$exception",
      properties: {
        $exception_list: [
          {
            type: "ServerAnalyticsException",
            value: "Server exception captured",
            mechanism: {
              handled: true,
              type: "generic",
            },
          },
        ],
        app_surface: "marketing",
        deployment_channel: "test",
        environment: "test",
        source: "checkout",
        error_name: "Error",
        repo: "weblingo_website",
        runtime: "server",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("sk_test_leak");
    expect(posthogMock.instances[0]?.captureException).not.toHaveBeenCalled();
    expect(posthogMock.instances[0]?.shutdown).not.toHaveBeenCalled();
  });

  it("does not block the caller while the scheduled send is pending", async () => {
    const immediate = createDeferred();
    posthogMock.immediatePromises.push(immediate.promise);
    const { captureServerAnalyticsEvent } = await import("./server");

    const result = captureServerAnalyticsEvent("waitlist_signup_saved");

    expect(result).toBeUndefined();
    expect(nextServerMock.after).toHaveBeenCalledOnce();
    expect(posthogMock.PostHog).not.toHaveBeenCalled();

    const task = nextServerMock.afterTasks.shift();
    let scheduledResolved = false;
    const scheduledPromise = Promise.resolve(task?.()).then(() => {
      scheduledResolved = true;
    });

    expect(posthogMock.instances[0]?.captureImmediate).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(scheduledResolved).toBe(false);

    immediate.resolve();
    await scheduledPromise;
    expect(scheduledResolved).toBe(true);
  });

  it("snapshots event properties before deferred execution", async () => {
    const { captureServerAnalyticsEvent } = await import("./server");
    const properties = {
      stripe_event_type: "checkout.session.completed",
    };

    captureServerAnalyticsEvent("stripe_webhook_received", properties);
    properties.stripe_event_type = "customer.subscription.updated";

    await runScheduledAfterTasks();

    expect(posthogMock.instances[0]?.captureImmediate).toHaveBeenCalledWith({
      distinctId: "server",
      event: "stripe_webhook_received",
      groups: undefined,
      properties: {
        app_surface: "checkout",
        deployment_channel: "test",
        environment: "test",
        repo: "weblingo_website",
        stripe_event_type: "checkout.session.completed",
        runtime: "server",
      },
    });
  });

  it("swallows immediate send failures", async () => {
    posthogMock.immediatePromises.push(Promise.reject(new Error("capture failed")));
    const { captureServerAnalyticsEvent } = await import("./server");

    captureServerAnalyticsEvent("waitlist_signup_saved");

    await expect(runScheduledAfterTasks()).resolves.toBeUndefined();
    expect(posthogMock.instances[0]?.captureImmediate).toHaveBeenCalledOnce();
  });

  it("does not schedule server analytics when capture is disabled", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "disabled";
    const { captureServerAnalyticsEvent, captureServerException } = await import("./server");

    captureServerAnalyticsEvent("waitlist_signup_saved");
    captureServerException(new Error("ignored"));

    expect(nextServerMock.after).not.toHaveBeenCalled();
    expect(posthogMock.PostHog).not.toHaveBeenCalled();
  });

  it("falls back to background work outside a Next request scope", async () => {
    nextServerMock.after.mockImplementationOnce(() => {
      throw new Error("no request scope");
    });
    const { captureServerAnalyticsEvent } = await import("./server");

    captureServerAnalyticsEvent("waitlist_signup_saved");

    expect(posthogMock.instances[0]?.captureImmediate).toHaveBeenCalledWith({
      distinctId: "server",
      event: "waitlist_signup_saved",
      groups: undefined,
      properties: {
        app_surface: "marketing",
        deployment_channel: "test",
        environment: "test",
        repo: "weblingo_website",
        runtime: "server",
      },
    });
  });

  it("hashes identifiers without retaining the raw value", async () => {
    const { hashAnalyticsIdentifier } = await import("./server");

    const hashed = hashAnalyticsIdentifier("stripe_session", "cs_live_sensitive");

    expect(hashed).toMatch(/^stripe_session:[a-f0-9]{20}$/);
    expect(hashed).not.toContain("cs_live_sensitive");
    expect(hashAnalyticsIdentifier("stripe_session", "")).toBeNull();
  });
});
