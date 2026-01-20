import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function makeRequest(payload: unknown, accept = "application/json") {
  return new Request("http://localhost/api/previews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: accept,
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

async function loadRoute() {
  vi.resetModules();
  return await import("../../app/api/previews/route");
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("preview api env", () => {
  it("returns 500 when preview env is missing", async () => {
    delete process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE;
    delete process.env.TRY_NOW_TOKEN;

    const { POST } = await loadRoute();
    const response = await POST(makeRequest({ sourceUrl: "https://example.com" }));

    expect(response.status).toBe(500);
  });

  it("uses public preview base with the server-only token", async () => {
    process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://client.example.com/api";
    process.env.TRY_NOW_TOKEN = "server-preview-token";
    process.env.NEXT_PUBLIC_TRY_NOW_TOKEN = "client-preview-token";

    const fetchSpy = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    const { POST } = await loadRoute();
    const response = await POST(makeRequest({ sourceUrl: "https://example.com" }));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls.at(0);
    if (!call) {
      throw new Error("Expected preview fetch to be called.");
    }
    const [url, init] = call;
    expect(url).toBe("https://client.example.com/api/previews");
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers["x-preview-token"]).toBe("server-preview-token");
  });
});
