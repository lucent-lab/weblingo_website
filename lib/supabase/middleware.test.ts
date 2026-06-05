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

function buildRequest(
  url: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(url, init);
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

  it("preserves dashboard return paths when redirecting anonymous users to login", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/sites/site-customer?tab=billing"),
    );

    expect(response.headers.get("location")).toBe(
      "https://weblingo.app/auth/login?next=%2Fdashboard%2Fsites%2Fsite-customer%3Ftab%3Dbilling",
    );
  });

  it("preserves locale-prefixed dashboard return paths when redirecting anonymous users to login", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/en/dashboard/sites/site-customer?tab=billing"),
    );

    expect(response.headers.get("location")).toBe(
      "https://weblingo.app/auth/login?next=%2Fdashboard%2Fsites%2Fsite-customer%3Ftab%3Dbilling%26locale%3Den",
    );
  });

  it("lets opaque demo dashboard sessions reach dashboard auth validation", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/sites/site-demo", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBe("1");
  });

  it("lets opaque demo dashboard sessions reach locale-prefixed dashboard site pages", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/en/dashboard/sites/site-demo", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBe("1");
  });

  it("lets opaque demo dashboard sessions reach focused site subroutes", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/sites/site-demo/pages", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBe("1");
  });

  it("lets opaque demo dashboard sessions reach site-scoped dashboard APIs", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/api/dashboard/sites/site-demo/status", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBe("1");
  });

  it("lets opaque demo dashboard sessions reach the dashboard redirect entry", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBe("1");
  });

  it("does not let demo dashboard cookies relax other global dashboard routes", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/developer-tools", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "https://weblingo.app/auth/login?next=%2Fdashboard%2Fdeveloper-tools",
    );
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBeNull();
  });

  it("does not mark other global dashboard routes as demo scoped for signed-in users", async () => {
    createServerClientMock.mockImplementation((() => ({
      auth: {
        getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-1" } } })),
      },
    })) as never);

    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/developer-tools", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBeNull();
  });

  it("does not mark global dashboard APIs as demo scoped for signed-in users", async () => {
    createServerClientMock.mockImplementation((() => ({
      auth: {
        getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-1" } } })),
      },
    })) as never);

    const response = await updateSession(
      buildRequest("https://weblingo.app/api/dashboard/ops/accounts", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBeNull();
  });

  it("does not let demo dashboard cookies reach site-scoped dashboard APIs without a site id", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/api/dashboard/sites", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBe("https://weblingo.app/auth/login");
    expect(response.headers.get("x-middleware-request-x-weblingo-dashboard-demo-scope")).toBeNull();
  });

  it("does not let demo dashboard cookies reach site creation", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/sites/new", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "https://weblingo.app/auth/login?next=%2Fdashboard%2Fsites%2Fnew",
    );
  });

  it("does not let demo dashboard cookies reach locale-prefixed site creation", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/fr/dashboard/sites/new", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBe(
      "https://weblingo.app/auth/login?next=%2Fdashboard%2Fsites%2Fnew%3Flocale%3Dfr",
    );
  });

  it("does not let demo dashboard cookies relax non-dashboard redirects", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/account", {
        headers: { Cookie: "weblingo_dashboard_demo=opaque-session-id" },
      }),
    );

    expect(response.headers.get("location")).toBe("https://weblingo.app/auth/login");
  });
});
