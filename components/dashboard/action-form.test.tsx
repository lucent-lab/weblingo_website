// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "@/app/dashboard/actions";

const refreshSpy = vi.fn();
const pushSpy = vi.fn();

let mockState: ActionResponse = { ok: false, message: "" };
let mockPending = false;

const formActionMock = vi.fn(async () => ({ ok: true, message: "ok" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshSpy,
    push: pushSpy,
  }),
}));

vi.mock("@internal/dashboard/use-action-toast", () => ({
  useActionToast: ({ formAction }: { formAction: (formData: FormData) => unknown }) => formAction,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [mockState, formActionMock, mockPending] as const,
  };
});

import { ActionForm } from "./action-form";

function renderActionForm(extraProps?: {
  refreshOnSuccess?: boolean;
  meta?: Record<string, unknown>;
}) {
  const action = async (
    prev: ActionResponse | undefined,
    formData: FormData,
  ): Promise<ActionResponse> => {
    void prev;
    void formData;
    return {
      ok: true,
      message: "ok",
    };
  };

  const children: ReactNode = <button type="submit">Submit</button>;

  return render(
    <ActionForm
      action={action}
      loading="Loading"
      success="Success"
      error="Error"
      refreshOnSuccess={extraProps?.refreshOnSuccess}
    >
      {children}
    </ActionForm>,
  );
}

function completeAction(
  rerender: (ui: ReactNode) => void,
  props?: { refreshOnSuccess?: boolean; meta?: Record<string, unknown> },
) {
  mockPending = true;
  mockState = { ok: false, message: "pending" };
  rerender(
    <ActionForm
      action={async () => ({ ok: true, message: "ok" })}
      loading="Loading"
      success="Success"
      error="Error"
      refreshOnSuccess={props?.refreshOnSuccess}
    >
      <button type="submit">Submit</button>
    </ActionForm>,
  );

  mockPending = false;
  mockState = {
    ok: true,
    message: "done",
    meta: props?.meta,
  };
  rerender(
    <ActionForm
      action={async () => ({ ok: true, message: "ok" })}
      loading="Loading"
      success="Success"
      error="Error"
      refreshOnSuccess={props?.refreshOnSuccess}
    >
      <button type="submit">Submit</button>
    </ActionForm>,
  );
}

beforeEach(() => {
  refreshSpy.mockReset();
  pushSpy.mockReset();
  formActionMock.mockReset();
  mockPending = false;
  mockState = { ok: false, message: "" };
});

describe("ActionForm refresh policy", () => {
  it("does not refresh by default after successful action", () => {
    const { rerender } = renderActionForm();
    completeAction(rerender);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("refreshes when refreshOnSuccess is true", () => {
    const { rerender } = renderActionForm({ refreshOnSuccess: true });
    completeAction(rerender, { refreshOnSuccess: true });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("honors action metadata refresh override", () => {
    const { rerender } = renderActionForm();
    completeAction(rerender, { meta: { refresh: true } });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("prioritizes redirect metadata over refresh", () => {
    const { rerender } = renderActionForm({ refreshOnSuccess: true });
    completeAction(rerender, {
      refreshOnSuccess: true,
      meta: { redirectTo: "/dashboard/sites/site-1", refresh: true },
    });
    expect(pushSpy).toHaveBeenCalledWith("/dashboard/sites/site-1");
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
