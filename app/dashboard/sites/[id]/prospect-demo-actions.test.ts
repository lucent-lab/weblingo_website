import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const readDashboardDemoSession = vi.fn();
vi.mock("@internal/dashboard/demo-session", () => ({ readDashboardDemoSession }));

const invalidateSiteDashboardCache = vi.fn();
vi.mock("@internal/dashboard/data", () => ({ invalidateSiteDashboardCache }));

const convertProspectShowcaseDemo = vi.fn();
class MockWebhooksApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
vi.mock("@internal/dashboard/webhooks", () => ({
  convertProspectShowcaseDemo,
  WebhooksApiError: MockWebhooksApiError,
}));

function makeSession() {
  return {
    token: "dashboard-demo-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
    entitlements: { planType: "starter", planStatus: "active" },
    actorAccountId: "acct-demo",
    subjectAccountId: "acct-demo",
    prospectShowcaseId: "ps-id",
    prospectShowcaseRef: "ps-demo-ref",
    siteId: "site-demo",
    demo: true,
    conversionToken: "conversion-token",
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("convertProspectDemoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readDashboardDemoSession.mockResolvedValue(makeSession());
  });

  it("converts the stored demo session and returns invite state", async () => {
    convertProspectShowcaseDemo.mockResolvedValue({
      prospectShowcaseRef: "ps-demo-ref",
      status: "checkout_pending",
      activationStatus: "activation_pending",
      locked: true,
      lockedReason: "payment_required",
      accountId: "acct-demo",
      siteId: "site-demo",
      nextAction: "complete_payment",
      inviteLink: "https://supabase.example.test/invite/demo",
    });
    const { convertProspectDemoAction } = await import("./prospect-demo-actions");
    const formData = new FormData();
    formData.set("siteId", "site-demo");
    formData.set("email", "Owner@Example.com");

    const result = await convertProspectDemoAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      messageKey: "activationInviteCreated",
      message: "Activation invite created.",
      meta: {
        status: "checkout_pending",
        activationStatus: "activation_pending",
        locked: true,
        lockedReason: "payment_required",
        nextAction: "complete_payment",
        inviteLink: "https://supabase.example.test/invite/demo",
        email: "Owner@Example.com",
      },
    });
    expect(convertProspectShowcaseDemo).toHaveBeenCalledWith(
      { token: "dashboard-demo-token" },
      "ps-demo-ref",
      {
        email: "Owner@Example.com",
        conversionToken: "conversion-token",
      },
    );
    expect(invalidateSiteDashboardCache).toHaveBeenCalledWith(
      {
        token: "dashboard-demo-token",
        expiresAt: "2030-01-01T00:00:00.000Z",
        subjectAccountId: "acct-demo",
        refresh: expect.any(Function),
      },
      "site-demo",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-demo");
  });

  it("rejects conversion for a different requested site", async () => {
    const { convertProspectDemoAction } = await import("./prospect-demo-actions");
    const formData = new FormData();
    formData.set("siteId", "site-other");
    formData.set("email", "owner@example.com");

    const result = await convertProspectDemoAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      messageKey: "siteMismatch",
      message: "This demo session can only activate its claimed site.",
    });
    expect(convertProspectShowcaseDemo).not.toHaveBeenCalled();
  });

  it("rejects conversion when the demo session is missing", async () => {
    readDashboardDemoSession.mockResolvedValue(null);
    const { convertProspectDemoAction } = await import("./prospect-demo-actions");
    const formData = new FormData();
    formData.set("siteId", "site-demo");
    formData.set("email", "owner@example.com");

    const result = await convertProspectDemoAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      messageKey: "sessionExpired",
      message: "Demo dashboard access has expired. Open the demo link again.",
    });
    expect(convertProspectShowcaseDemo).not.toHaveBeenCalled();
  });
});
