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
  WebhooksApiError: class WebhooksApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
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
    formData.set("maxSites", "1");
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
        maxSites: 1,
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

  it("fails closed when internal admin actor auth is unavailable", async () => {
    requireDashboardAuth.mockResolvedValue({
      actorWebhooksAuth: null,
      webhooksAuth: { token: "subject-token", subjectAccountId: "acct-admin" },
      actorAccount: { accountId: "acct-admin", planType: "agency", featureFlags: {} },
    });

    const { updateAdminAccountPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountId", "acct-customer");
    formData.set("planType", "starter");
    formData.set("planStatus", "active");
    formData.set("managedDemo", "true");

    const result = await updateAdminAccountPolicyAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(updateAdminAccount).not.toHaveBeenCalled();
  });

  it.each(["0", "2"])(
    "clears unsupported customer maxSites value %s before calling the backend",
    async (staleMaxSites) => {
      const { updateAdminAccountPolicyAction } = await import("./actions");
      const formData = new FormData();
      formData.set("accountId", "acct-customer");
      formData.set("planType", "starter");
      formData.set("planStatus", "active");
      formData.set("maxSites", staleMaxSites);

      const result = await updateAdminAccountPolicyAction(undefined, formData);

      expect(result).toMatchObject({ ok: true, message: "Account policy updated." });
      expect(updateAdminAccount).toHaveBeenCalledWith(
        expect.objectContaining({ token: "actor-token" }),
        "acct-customer",
        expect.objectContaining({
          maxSites: null,
        }),
      );
    },
  );

  it("removes stale customer maxSites feature-flag overrides before calling the backend", async () => {
    const { updateAdminAccountPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountId", "acct-customer");
    formData.set("planType", "starter");
    formData.set("planStatus", "active");
    formData.set(
      "featureFlags",
      JSON.stringify({
        maxSites: 0,
        glossaryEnabled: true,
      }),
    );

    const result = await updateAdminAccountPolicyAction(undefined, formData);

    expect(result).toMatchObject({ ok: true, message: "Account policy updated." });
    expect(updateAdminAccount).toHaveBeenCalledWith(
      expect.objectContaining({ token: "actor-token" }),
      "acct-customer",
      expect.objectContaining({
        featureFlags: {
          glossaryEnabled: true,
        },
      }),
    );
  });

  it("shows the single-site account limit when the backend rejects stale policy input", async () => {
    const { WebhooksApiError } = await import("@internal/dashboard/webhooks");
    updateAdminAccount.mockRejectedValueOnce(
      new WebhooksApiError("Customer accounts support one active website", 400, {
        code: "single_site_account_limit",
      }),
    );
    const { updateAdminAccountPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountId", "acct-customer");
    formData.set("planType", "starter");
    formData.set("planStatus", "active");
    formData.set("maxSites", "1");

    const result = await updateAdminAccountPolicyAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message:
        "Customer accounts support exactly one website. Leave Max sites blank or set it to 1.",
      meta: undefined,
    });
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
