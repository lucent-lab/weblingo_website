import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ORIGINAL_ENV = { ...process.env };
const fetchMock = vi.fn<typeof fetch>();

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "http://localhost:3000/_analytics/posthog";
  process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "enabled";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
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

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.com";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "dummy";
}

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
  vi.stubGlobal("fetch", fetchMock);
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("PostHog proxy route", () => {
  it("forwards POST requests to the configured upstream host", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    fetchMock.mockResolvedValueOnce(
      new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
        status: 202,
      }),
    );

    const response = await POST(
      buildRequest("http://localhost:3000/api/analytics/posthog/e/?ip=1", {
        body: '{"event":"preview_ready"}',
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.2.3.4",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["e"] }) },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://eu.i.posthog.com/e?ip=1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      redirect: "manual",
    });
    expect(response.status).toBe(202);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("forwards GET requests without a request body", async () => {
    vi.resetModules();
    const { GET } = await import("./route");
    fetchMock.mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await GET(buildRequest("http://localhost:3000/api/analytics/posthog/decide/?v=3"), {
      params: Promise.resolve({ path: ["decide"] }),
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: undefined,
      method: "GET",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://eu.i.posthog.com/decide?v=3");
  });

  it("degrades without throwing when the upstream analytics host is unavailable", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await POST(
      buildRequest("http://localhost:3000/api/analytics/posthog/e/?ip=1", {
        body: '{"event":"preview_ready"}',
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["e"] }) },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("degrades without surfacing upstream ingestion error responses to the browser", async () => {
    vi.resetModules();
    const { POST } = await import("./route");
    fetchMock.mockResolvedValueOnce(
      new Response("not found", {
        status: 404,
      }),
    );

    const response = await POST(
      buildRequest("http://localhost:3000/api/analytics/posthog/e", {
        body: "{}",
        method: "POST",
      }),
      { params: Promise.resolve({ path: ["e"] }) },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("surfaces upstream script failures so PostHog dependency loaders receive onerror", async () => {
    vi.resetModules();
    const { GET } = await import("./route");
    fetchMock.mockResolvedValueOnce(
      new Response("not found", {
        status: 404,
      }),
    );

    const response = await GET(
      buildRequest("http://localhost:3000/api/analytics/posthog/static/posthog-recorder.js"),
      { params: Promise.resolve({ path: ["static", "posthog-recorder.js"] }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("surfaces script fetch failures instead of returning blank successful JavaScript", async () => {
    vi.resetModules();
    const { GET } = await import("./route");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const response = await GET(
      buildRequest("http://localhost:3000/api/analytics/posthog/array/phc_test/config.js"),
      { params: Promise.resolve({ path: ["array", "phc_test", "config.js"] }) },
    );

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
