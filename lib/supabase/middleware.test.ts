import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

type SupabaseCookieBridge = {
  cookies: {
    setAll(
      cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
    ): void;
  };
};

const createServerClientMock = vi.mocked(createServerClient);

function buildRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("updateSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    createServerClientMock.mockImplementation((() => ({
      auth: {
        getClaims: vi.fn(async () => ({ data: { claims: null } })),
      },
    })) as never);
  });

  it("rewrites the public demo dashboard outside the authenticated dashboard layout", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/demo?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token",
    );
    expect(createServerClientMock).toHaveBeenCalledOnce();
  });

  it("rewrites the public demo dashboard with a trailing slash", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/demo/?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token",
    );
  });

  it("rewrites a locale-prefixed public demo dashboard outside the authenticated dashboard layout", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/en/dashboard/demo?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token&locale=en",
    );
  });

  it("rewrites a locale-prefixed public demo dashboard with a trailing slash", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/fr/dashboard/demo/?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token&locale=fr",
    );
  });

  it("preserves Supabase refresh cookies when rewriting the public demo dashboard", async () => {
    createServerClientMock.mockImplementation(((
      _url: string,
      _key: string,
      options: SupabaseCookieBridge,
    ) => ({
      auth: {
        getClaims: vi.fn(async () => {
          options.cookies.setAll([
            {
              name: "sb-refresh-token",
              value: "fresh-token",
              options: { path: "/", httpOnly: true },
            },
          ]);
          return { data: { claims: null } };
        }),
      },
    })) as never);

    const response = await updateSession(
      buildRequest("https://weblingo.app/fr/dashboard/demo?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token&locale=fr",
    );
    expect(response.cookies.get("sb-refresh-token")?.value).toBe("fresh-token");
  });
});
