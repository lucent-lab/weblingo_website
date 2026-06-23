import { afterEach, describe, expect, test, vi } from "vitest";

import { evaluateTurnstile, verifyTurnstileToken } from "./turnstile";

const SECRET = "0xSECRET";

function jsonResponse(payload: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyTurnstileToken", () => {
  test.each([null, undefined, "", "   "])(
    "returns missing-token without calling Cloudflare for %p",
    async (token) => {
      const fetchMock = stubFetch(async () => jsonResponse({ success: true }));
      const outcome = await verifyTurnstileToken({ secretKey: SECRET, token });
      expect(outcome).toEqual({ ok: false, reason: "missing-token" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("returns ok on Cloudflare success", async () => {
    stubFetch(async () => jsonResponse({ success: true }));
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({ ok: true });
  });

  test("returns rejected with error codes when Cloudflare denies", async () => {
    stubFetch(async () =>
      jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-response"],
    });
  });

  test("returns unavailable on non-2xx response", async () => {
    stubFetch(async () => jsonResponse({ success: true }, { status: 500 }));
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  test("returns unavailable when fetch throws (network/timeout)", async () => {
    stubFetch(async () => {
      throw new Error("boom");
    });
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  test("returns unavailable on invalid JSON", async () => {
    stubFetch(
      async () =>
        new Response("<html>nope", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  test("returns unavailable when payload shape is unexpected", async () => {
    stubFetch(async () => jsonResponse({ success: "yes" }));
    const outcome = await verifyTurnstileToken({ secretKey: SECRET, token: "tok" });
    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  test("forwards remoteip and credentials, omitting unknown ip", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: true }));

    await verifyTurnstileToken({ secretKey: SECRET, token: "  tok  ", remoteIp: "203.0.113.7" });
    const [, withIpInit] = fetchMock.mock.calls[0]!;
    const withIpBody = withIpInit!.body as URLSearchParams;
    expect(withIpBody.get("secret")).toBe(SECRET);
    expect(withIpBody.get("response")).toBe("tok");
    expect(withIpBody.get("remoteip")).toBe("203.0.113.7");

    await verifyTurnstileToken({ secretKey: SECRET, token: "tok", remoteIp: "unknown" });
    const [, unknownInit] = fetchMock.mock.calls[1]!;
    const unknownBody = unknownInit!.body as URLSearchParams;
    expect(unknownBody.get("remoteip")).toBeNull();
  });
});

describe("evaluateTurnstile", () => {
  test("is disabled (allowed, not enforced) when no secret is configured", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: true }));
    const decision = await evaluateTurnstile({
      secretKey: undefined,
      token: null,
      failClosed: true,
    });
    expect(decision).toEqual({ allowed: true, enforced: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows a valid token", async () => {
    stubFetch(async () => jsonResponse({ success: true }));
    const decision = await evaluateTurnstile({
      secretKey: SECRET,
      token: "tok",
      failClosed: true,
    });
    expect(decision).toEqual({ allowed: true, enforced: true });
  });

  test("always blocks a rejected token, even on fail-open endpoints", async () => {
    stubFetch(async () => jsonResponse({ success: false, "error-codes": ["bad"] }));
    const decision = await evaluateTurnstile({
      secretKey: SECRET,
      token: "tok",
      failClosed: false,
    });
    expect(decision).toEqual({ allowed: false, enforced: true, status: 403, reason: "rejected" });
  });

  test("always blocks a missing token, even on fail-open endpoints", async () => {
    stubFetch(async () => jsonResponse({ success: true }));
    const decision = await evaluateTurnstile({
      secretKey: SECRET,
      token: "",
      failClosed: false,
    });
    expect(decision).toEqual({
      allowed: false,
      enforced: true,
      status: 403,
      reason: "missing-token",
    });
  });

  test("fail-closed blocks (503) when Cloudflare is unavailable", async () => {
    stubFetch(async () => {
      throw new Error("down");
    });
    const decision = await evaluateTurnstile({
      secretKey: SECRET,
      token: "tok",
      failClosed: true,
    });
    expect(decision).toEqual({
      allowed: false,
      enforced: true,
      status: 503,
      reason: "unavailable",
    });
  });

  test("fail-open allows when Cloudflare is unavailable", async () => {
    stubFetch(async () => {
      throw new Error("down");
    });
    const decision = await evaluateTurnstile({
      secretKey: SECRET,
      token: "tok",
      failClosed: false,
    });
    expect(decision).toEqual({ allowed: true, enforced: true });
  });
});
