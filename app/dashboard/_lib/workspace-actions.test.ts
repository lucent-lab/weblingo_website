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
vi.mock("next/navigation", () => ({ redirect }));

const cookiesStore = {
  delete: vi.fn(),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookiesStore),
}));

const requireDashboardAuth = vi.fn();
const getActiveAgencyCustomers = vi.fn();
vi.mock("@internal/dashboard/auth", () => ({
  getActiveAgencyCustomers,
  requireDashboardAuth,
}));

beforeEach(() => {
  cookiesStore.delete.mockReset();
  cookiesStore.set.mockReset();
  redirect.mockClear();
  requireDashboardAuth.mockReset();
  getActiveAgencyCustomers.mockReset();
  getActiveAgencyCustomers.mockReturnValue([]);
});

describe("setWorkspaceAction", () => {
  it("clears stale workspace cookies when the selected account is no longer allowed", async () => {
    requireDashboardAuth.mockResolvedValue({
      actorAccount: { accountId: "acct-agency", planType: "agency" },
      account: { accountId: "acct-agency" },
      agencyCustomers: {
        summary: { totalActiveSites: 0, maxSites: 10 },
        customers: [
          {
            agencyAccountId: "acct-agency",
            customerAccountId: "acct-active",
            customerEmail: "active@example.com",
            customerPlan: "starter",
            planStatus: "active",
            status: "active",
            activeSiteCount: 1,
          },
        ],
      },
    });
    getActiveAgencyCustomers.mockReturnValue([
      {
        agencyAccountId: "acct-agency",
        customerAccountId: "acct-active",
        customerEmail: "active@example.com",
        customerPlan: "starter",
        planStatus: "active",
        status: "active",
        activeSiteCount: 1,
      },
    ]);

    vi.resetModules();
    const { setWorkspaceAction } = await import("./workspace-actions");
    const formData = new FormData();
    formData.set("subjectAccountId", "acct-stale");

    await expect(setWorkspaceAction(formData)).rejects.toMatchObject({
      url: "/dashboard",
    });

    expect(cookiesStore.delete).toHaveBeenCalledOnce();
    expect(cookiesStore.set).not.toHaveBeenCalled();
  });
});
