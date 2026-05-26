// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

beforeEach(() => {
  posthogMock.capture.mockReset();
  posthogMock.group.mockReset();
  posthogMock.identify.mockReset();
  posthogMock.reset.mockReset();
});

describe("client analytics helpers", () => {
  it("identifies dashboard users and groups them by account", async () => {
    const { identifyAnalyticsUser } = await import("./client");

    identifyAnalyticsUser({
      distinctId: " user-1 ",
      accountId: " acct-1 ",
      actorAccountId: " acct-admin ",
      planType: " pro ",
      planStatus: " active ",
      workspaceAudience: " agency ",
      actingAsCustomer: true,
    });

    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      account_id: "acct-1",
      actor_account_id: "acct-admin",
      dashboard_plan_type: "pro",
      dashboard_plan_status: "active",
      dashboard_workspace_audience: "agency",
      dashboard_acting_as_customer: true,
      dashboard_user: true,
    });
    expect(posthogMock.group).toHaveBeenCalledWith("account", "acct-1", {
      plan_type: "pro",
      plan_status: "active",
      workspace_audience: "agency",
    });
  });

  it("skips identity calls without a distinct id", async () => {
    const { identifyAnalyticsUser } = await import("./client");

    identifyAnalyticsUser({ distinctId: " ", accountId: "acct-1" });

    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.group).not.toHaveBeenCalled();
  });

  it("resets analytics identity during sign-out", async () => {
    const { resetAnalyticsIdentity } = await import("./client");

    resetAnalyticsIdentity();

    expect(posthogMock.reset).toHaveBeenCalledOnce();
  });
});
