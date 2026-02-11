import { describe, expect, test } from "vitest";

import { rateLimitFixedWindow } from "./rate-limit";

describe("rateLimitFixedWindow", () => {
  test("allows up to limit within a window and denies over limit", async () => {
    const counts = new Map<string, number>();
    const expires = new Map<string, number>();

    const redis = {
      incr: async (key: string) => {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      },
      expire: async (key: string, seconds: number) => {
        expires.set(key, seconds);
      },
    };

    const nowMs = 1_700_000_000_000;
    const windowMs = 10_000;

    const r1 = await rateLimitFixedWindow(redis, { key: "k", limit: 3, windowMs, nowMs });
    const r2 = await rateLimitFixedWindow(redis, { key: "k", limit: 3, windowMs, nowMs });
    const r3 = await rateLimitFixedWindow(redis, { key: "k", limit: 3, windowMs, nowMs });
    const r4 = await rateLimitFixedWindow(redis, { key: "k", limit: 3, windowMs, nowMs });

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);

    // We set TTL only once for the window key.
    expect(expires.size).toBe(1);
  });
});
