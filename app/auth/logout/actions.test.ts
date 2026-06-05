import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  url: string;

  constructor(url: string) {
    super("redirect");
    this.url = url;
  }
}

const redirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});
const createClient = vi.fn();
const clearSubjectAccountId = vi.fn();
const clearDashboardDemoSessionCookie = vi.fn();

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@internal/dashboard/workspace", () => ({ clearSubjectAccountId }));
vi.mock("@internal/dashboard/demo-session", () => ({ clearDashboardDemoSessionCookie }));

beforeEach(() => {
  redirect.mockClear();
  createClient.mockReset();
  clearSubjectAccountId.mockClear();
  clearDashboardDemoSessionCookie.mockClear();
});

describe("logout", () => {
  it("clears the selected workspace cookie", async () => {
    createClient.mockResolvedValue({
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });

    vi.resetModules();
    const { logout } = await import("./actions");

    await expect(logout()).rejects.toMatchObject({
      url: "/auth/login",
    });

    expect(clearSubjectAccountId).toHaveBeenCalledOnce();
    expect(clearDashboardDemoSessionCookie).toHaveBeenCalledOnce();
  });
});
