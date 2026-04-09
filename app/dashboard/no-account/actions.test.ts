import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const fetchWithTimeout = vi.fn();
const invalidateDashboardBootstrapCache = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/internal/dashboard/auth", () => ({
  invalidateDashboardBootstrapCache,
}));

vi.mock("@internal/core/env-server", () => ({
  envServer: {
    PUBLIC_PORTAL_MODE: "enabled",
    NEXT_PUBLIC_WEBHOOKS_API_BASE: "https://api.example.com/api",
    NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: "5000",
  },
}));

vi.mock("@internal/core/fetch-timeout", () => ({
  FetchTimeoutError: class extends Error {},
  fetchWithTimeout,
}));

describe("claimAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an explicit dashboard-access success state", async () => {
    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "supabase-access-token" } },
        }),
      },
    });
    fetchWithTimeout.mockResolvedValue(new Response(null, { status: 200 }));

    const { claimAccount } = await import("./actions");
    const result = await claimAccount(undefined, new FormData());

    expect(result).toEqual({
      ok: true,
      message: "Dashboard access linked. Redirecting to dashboard.",
      meta: {
        redirectTo: "/dashboard",
        refresh: false,
        onboardingState: "claimed_free_account",
      },
    });
    expect(invalidateDashboardBootstrapCache).toHaveBeenCalledWith("supabase-access-token");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
