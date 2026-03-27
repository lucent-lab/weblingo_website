import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireDashboardAuth = vi.fn();
vi.mock("@internal/dashboard/auth", () => ({ requireDashboardAuth }));

const createAgencyCustomer = vi.fn();
const updateAgencyCustomer = vi.fn();
vi.mock("@internal/dashboard/webhooks", () => ({
  createAgencyCustomer,
  updateAgencyCustomer,
}));

describe("agency actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDashboardAuth.mockResolvedValue({
      actorAccount: { planType: "agency" },
      actorWebhooksAuth: { token: "actor-token", subjectAccountId: "acct-agency" },
      actorPlanActive: true,
    });
  });

  it("updates a managed customer plan within the agency envelope", async () => {
    const { updateAgencyCustomerPlanAction } = await import("./actions");
    const formData = new FormData();
    formData.set("customerAccountId", "acct-customer");
    formData.set("customerPlan", "pro");

    const result = await updateAgencyCustomerPlanAction(undefined, formData);

    expect(result).toMatchObject({ ok: true, message: "Customer plan updated." });
    expect(updateAgencyCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ token: "actor-token" }),
      "acct-customer",
      { customerPlan: "pro" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/agency/customers");
  });

  it("rejects agency attempts to assign unsupported plans", async () => {
    const { updateAgencyCustomerPlanAction } = await import("./actions");
    const formData = new FormData();
    formData.set("customerAccountId", "acct-customer");
    formData.set("customerPlan", "free");

    const result = await updateAgencyCustomerPlanAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Agencies can only assign Starter or Pro.",
      meta: undefined,
    });
    expect(updateAgencyCustomer).not.toHaveBeenCalled();
  });
});
