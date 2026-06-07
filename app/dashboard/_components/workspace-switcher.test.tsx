// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureAnalyticsEventMock } = vi.hoisted(() => ({
  captureAnalyticsEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/sites/site-1",
}));

vi.mock("../_lib/workspace-actions", () => ({
  setWorkspaceAction: vi.fn(),
}));

vi.mock("@internal/analytics/client", async () => {
  const actual = await vi.importActual<typeof import("@internal/analytics/client")>(
    "@internal/analytics/client",
  );

  return {
    ...actual,
    captureAnalyticsEvent: captureAnalyticsEventMock,
  };
});

import { WorkspaceSwitcher } from "./workspace-switcher";

afterEach(() => {
  captureAnalyticsEventMock.mockReset();
  vi.restoreAllMocks();
});

describe("WorkspaceSwitcher", () => {
  it("sends the submitted workspace switch before redirecting", () => {
    const requestSubmitSpy = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);

    render(
      <WorkspaceSwitcher
        actorAccountId="acct-actor"
        currentId="acct-actor"
        options={[
          { id: "acct-actor", label: "Main workspace" },
          { id: "acct-customer", label: "Customer workspace" },
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "acct-customer" },
    });

    expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
      "workspace_switched",
      expect.objectContaining({
        account_id: "acct-customer",
        actor_account_id: "acct-actor",
        feature: "workspace_switcher",
        outcome: "submitted",
        subject_account_id: "acct-customer",
      }),
      { sendInstantly: true },
    );
    expect(requestSubmitSpy).toHaveBeenCalledOnce();
  });
});
