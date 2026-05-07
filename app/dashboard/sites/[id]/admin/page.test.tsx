import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("SiteAdminRedirectPage", () => {
  it("redirects legacy admin URLs to focused settings", async () => {
    vi.resetModules();
    const { default: SiteAdminRedirectPage } = await import("./page");

    await expect(
      SiteAdminRedirectPage({ params: Promise.resolve({ id: "site-1" }) }),
    ).rejects.toThrow("redirect:/dashboard/sites/site-1/settings");
    expect(redirect).toHaveBeenCalledWith("/dashboard/sites/site-1/settings");
  });
});
