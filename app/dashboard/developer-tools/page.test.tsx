import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  requireDashboardAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("@internal/core", () => ({
  env: {
    NEXT_PUBLIC_WEBHOOKS_API_BASE: "https://api.example.test",
  },
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));

function collectStrings(node: unknown): string[] {
  if (node == null || typeof node === "boolean") {
    return [];
  }
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectStrings);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const props = node.props as Record<string, unknown>;
  return [
    ...Object.entries(props)
      .filter(([key]) => key !== "children")
      .flatMap(([, value]) => collectStrings(value)),
    ...collectStrings(props.children),
  ];
}

describe("DeveloperToolsPage", () => {
  it("does not render the dashboard bearer token", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "supabase",
      demoSession: null,
      webhooksAuth: {
        token: "secret-dashboard-token",
        expiresAt: "2026-01-01T00:00:00.000Z",
      },
      session: { expires_at: 1_767_225_600 },
      user: {
        id: "user-1",
        email: "user@example.com",
        app_metadata: { provider: "password" },
      },
    });

    vi.resetModules();
    const { default: DeveloperToolsPage } = await import("./page");
    const tree = await DeveloperToolsPage();
    const rendered = collectStrings(tree).join("\n");

    expect(rendered).not.toContain("secret-dashboard-token");
    expect(rendered).not.toContain("Bearer ");
    expect(rendered).toContain("Available for this session");
  });

  it("does not render global developer tools for demo scoped auth", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
      webhooksAuth: {
        token: "demo-dashboard-token",
        expiresAt: "2026-01-01T00:00:00.000Z",
      },
      session: { expires_at: 1_767_225_600 },
      user: {
        id: "prospect-demo:ref",
        email: "prospect-demo@weblingo.app",
        app_metadata: {},
      },
    });

    vi.resetModules();
    const { default: DeveloperToolsPage } = await import("./page");

    await expect(DeveloperToolsPage()).rejects.toThrow("notFound");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
