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
const revalidatePath = vi.fn();
const createClient = vi.fn();
const clearSubjectAccountId = vi.fn();
const captureServerAnalyticsEvent = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@internal/analytics/server", () => ({ captureServerAnalyticsEvent }));
vi.mock("@internal/core/env-server", () => ({
  envServer: {
    PUBLIC_PORTAL_MODE: "enabled",
  },
}));
vi.mock("@internal/dashboard/workspace", () => ({ clearSubjectAccountId }));

beforeEach(() => {
  redirect.mockClear();
  revalidatePath.mockClear();
  createClient.mockReset();
  clearSubjectAccountId.mockClear();
  captureServerAnalyticsEvent.mockClear();
});

describe("auth login actions", () => {
  it("clears the selected workspace after successful login", async () => {
    createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
    });

    vi.resetModules();
    const { login } = await import("./actions");
    const formData = new FormData();
    formData.set("email", "customer@example.com");
    formData.set("password", "password");

    await expect(login({ error: null, notice: null }, formData)).rejects.toMatchObject({
      url: "/dashboard",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(clearSubjectAccountId).toHaveBeenCalledOnce();
  });

  it("redirects successful login to a sanitized dashboard return path", async () => {
    createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
    });

    vi.resetModules();
    const { login } = await import("./actions");
    const formData = new FormData();
    formData.set("email", "customer@example.com");
    formData.set("password", "password");
    formData.set("redirectTo", "/dashboard/sites/site-customer");

    await expect(login({ error: null, notice: null }, formData)).rejects.toMatchObject({
      url: "/dashboard/sites/site-customer",
    });
  });

  it("falls back to the dashboard when login receives an unsafe return path", async () => {
    createClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
    });

    vi.resetModules();
    const { login } = await import("./actions");
    const formData = new FormData();
    formData.set("email", "customer@example.com");
    formData.set("password", "password");
    formData.set("redirectTo", "https://example.test/dashboard");

    await expect(login({ error: null, notice: null }, formData)).rejects.toMatchObject({
      url: "/dashboard",
    });
  });

  it("clears the selected workspace after successful signup", async () => {
    createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token" } },
          error: null,
        }),
      },
    });

    vi.resetModules();
    const { signup } = await import("./actions");
    const formData = new FormData();
    formData.set("email", "customer@example.com");
    formData.set("password", "password");

    await expect(signup({ error: null, notice: null }, formData)).rejects.toMatchObject({
      url: "/dashboard",
    });

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(clearSubjectAccountId).toHaveBeenCalledOnce();
  });

  it("tracks confirmation-pending signup as submitted, not authenticated", async () => {
    createClient.mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
      },
    });

    vi.resetModules();
    const { signup } = await import("./actions");
    const formData = new FormData();
    formData.set("email", "customer@example.com");
    formData.set("password", "password");

    const result = await signup({ error: null, notice: null }, formData);

    expect(result).toMatchObject({
      error: null,
      notice: expect.stringContaining("Check your email"),
    });
    expect(captureServerAnalyticsEvent).toHaveBeenCalledWith(
      "auth_confirmation_required",
      expect.objectContaining({
        auth_action: "signup",
        outcome: "email_confirmation_required",
      }),
    );
    expect(
      captureServerAnalyticsEvent.mock.calls.some(([event]) => event === "auth_submitted"),
    ).toBe(false);
    expect(
      captureServerAnalyticsEvent.mock.calls.some(([event]) => event === "auth_succeeded"),
    ).toBe(false);
  });
});
