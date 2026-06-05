import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireDashboardAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));

describe("SiteConsistencyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects scoped dashboard auth to the translation rules page", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
    });

    vi.resetModules();
    const { default: SiteConsistencyPage } = await import("./page");

    await expect(
      SiteConsistencyPage({
        params: Promise.resolve({ id: "site-demo" }),
        searchParams: Promise.resolve({ sourceLang: "en", targetLang: "fr" }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard/sites/site-demo/overrides?sourceLang=en&targetLang=fr",
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/dashboard/sites/site-demo/overrides?sourceLang=en&targetLang=fr",
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("404s demo scoped auth before redirecting a different site", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
    });

    vi.resetModules();
    const { default: SiteConsistencyPage } = await import("./page");

    await expect(
      SiteConsistencyPage({
        params: Promise.resolve({ id: "site-other" }),
      }),
    ).rejects.toThrow("notFound");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
