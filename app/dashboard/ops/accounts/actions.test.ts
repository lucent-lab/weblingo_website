import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireDashboardAuth = vi.fn();
const hasActorInternalOps = vi.fn();
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth,
  hasActorInternalOps,
}));

const updateAdminAccount = vi.fn();
vi.mock("@internal/dashboard/webhooks", () => ({
  updateAdminAccount,
}));

describe("ops account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActorInternalOps.mockReturnValue(true);
    requireDashboardAuth.mockResolvedValue({
      actorWebhooksAuth: { token: "actor-token", subjectAccountId: "acct-admin" },
      webhooksAuth: { token: "subject-token", subjectAccountId: "acct-admin" },
    });
  });

  it("updates managed account policy with parsed quota and feature-flag payloads", async () => {
    const { updateAdminAccountPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountId", "acct-customer");
    formData.set("planType", "starter");
    formData.set("planStatus", "active");
    formData.set("managedDemo", "true");
    formData.set("maxSites", "5");
    formData.set("freeQuota", "");
    formData.set("starterQuota", "2000");
    formData.set("proQuota", "");
    formData.set(
      "featureFlags",
      JSON.stringify({
        internalOpsEnabled: true,
        featurePreview: ["managed-account-dashboard"],
      }),
    );

    const result = await updateAdminAccountPolicyAction(undefined, formData);

    expect(result).toMatchObject({ ok: true, message: "Account policy updated." });
    expect(updateAdminAccount).toHaveBeenCalledWith(
      expect.objectContaining({ token: "actor-token" }),
      "acct-customer",
      {
        planType: "starter",
        planStatus: "active",
        managedDemo: true,
        maxSites: 5,
        freeQuota: null,
        starterQuota: 2000,
        proQuota: null,
        featureFlags: {
          internalOpsEnabled: true,
          featurePreview: ["managed-account-dashboard"],
        },
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/ops/accounts/acct-customer");
  });

  it("rejects invalid feature-flag JSON", async () => {
    const { updateAdminAccountPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountId", "acct-customer");
    formData.set("planType", "pro");
    formData.set("planStatus", "active");
    formData.set("featureFlags", "{bad json");

    const result = await updateAdminAccountPolicyAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Feature flag overrides must be valid JSON.",
      meta: undefined,
    });
    expect(updateAdminAccount).not.toHaveBeenCalled();
  });
});
