// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "@/app/dashboard/actions";

const refreshSpy = vi.fn();
const pushSpy = vi.fn();
const analyticsMocks = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
}));

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

vi.mock("@internal/analytics/client", () => ({
  captureAnalyticsEvent: analyticsMocks.captureAnalyticsEvent,
  isAnalyticsEventName: (value: unknown) =>
    value === "crawl_trigger_failed" ||
    value === "domain_provision_pending" ||
    value === "domain_provisioned",
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
  analytics?: Parameters<typeof ActionForm>[0]["analytics"];
  refreshOnSuccess?: boolean;
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
      analytics={extraProps?.analytics}
      refreshOnSuccess={extraProps?.refreshOnSuccess}
    >
      {children}
    </ActionForm>,
  );
}

function completeAction(
  rerender: (ui: ReactNode) => void,
  props?: {
    analytics?: Parameters<typeof ActionForm>[0]["analytics"];
    meta?: Record<string, unknown>;
    ok?: boolean;
    refreshOnSuccess?: boolean;
  },
) {
  mockPending = true;
  mockState = { ok: false, message: "pending" };
  rerender(
    <ActionForm
      action={async () => ({ ok: true, message: "ok" })}
      loading="Loading"
      success="Success"
      error="Error"
      analytics={props?.analytics}
      refreshOnSuccess={props?.refreshOnSuccess}
    >
      <button type="submit">Submit</button>
    </ActionForm>,
  );

  mockPending = false;
  mockState = {
    ok: props?.ok ?? true,
    message: "done",
    meta: props?.meta,
  };
  rerender(
    <ActionForm
      action={async () => ({ ok: true, message: "ok" })}
      loading="Loading"
      success="Success"
      error="Error"
      analytics={props?.analytics}
      refreshOnSuccess={props?.refreshOnSuccess}
    >
      <button type="submit">Submit</button>
    </ActionForm>,
  );
}

beforeEach(() => {
  refreshSpy.mockReset();
  pushSpy.mockReset();
  analyticsMocks.captureAnalyticsEvent.mockReset();
  formActionMock.mockReset();
  mockPending = false;
  mockState = { ok: false, message: "" };
});

afterEach(() => {
  cleanup();
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

  it("sends submitted analytics immediately", () => {
    const { container } = renderActionForm({
      analytics: {
        event: "site_setting_saved",
        properties: {
          site_id: "site-1",
          feature: "site_settings",
        },
      },
    });

    fireEvent.submit(container.querySelector("form")!);

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "site_setting_saved",
      {
        feature: "site_settings",
        outcome: "submitted",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
  });

  it("can suppress submitted analytics while keeping settled analytics", () => {
    const analytics = {
      event: "domain_provisioned",
      properties: {
        site_id: "site-1",
        feature: "domain_setup",
      },
      submitEvent: false,
    } as const;
    const { container, rerender } = renderActionForm({ analytics });

    fireEvent.submit(container.querySelector("form")!);

    expect(analyticsMocks.captureAnalyticsEvent).not.toHaveBeenCalled();

    completeAction(rerender, { analytics });

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "domain_provisioned",
      {
        feature: "domain_setup",
        outcome: "succeeded",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
  });

  it("sends settled analytics immediately before refresh or redirect", () => {
    const analytics = {
      event: "domain_provision_requested",
      failureEvent: "domain_provision_failed",
      properties: {
        site_id: "site-1",
        feature: "domain_setup",
      },
      successEvent: "domain_provisioned",
    } as const;
    const { rerender } = renderActionForm({ analytics });

    completeAction(rerender, {
      analytics,
      meta: { refresh: true },
    });

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "domain_provisioned",
      {
        feature: "domain_setup",
        outcome: "succeeded",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("uses guarded action metadata for pending settled analytics", () => {
    const analytics = {
      event: "domain_provision_requested",
      properties: {
        site_id: "site-1",
        feature: "domain_setup",
      },
      successEvent: "domain_provisioned",
    } as const;
    const { rerender } = renderActionForm({ analytics });

    completeAction(rerender, {
      analytics,
      meta: {
        analyticsEvent: "domain_provision_pending",
        analyticsOutcome: "pending",
      },
    });

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "domain_provision_pending",
      {
        feature: "domain_setup",
        outcome: "pending",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
  });

  it("uses guarded action metadata for failed settled analytics", () => {
    const analytics = {
      event: "crawl_triggered",
      properties: {
        site_id: "site-1",
        feature: "site_crawl",
      },
    } as const;
    const { rerender } = renderActionForm({ analytics });

    completeAction(rerender, {
      analytics,
      ok: false,
      meta: {
        analyticsEvent: "crawl_trigger_failed",
        code: "crawl_enqueue_failed",
      },
    });

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "crawl_trigger_failed",
      {
        error_code: "crawl_enqueue_failed",
        feature: "site_crawl",
        outcome: "failed",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
  });

  it("ignores unknown metadata event names", () => {
    const analytics = {
      event: "domain_provision_requested",
      properties: {
        site_id: "site-1",
        feature: "domain_setup",
      },
      successEvent: "domain_provisioned",
    } as const;
    const { rerender } = renderActionForm({ analytics });

    completeAction(rerender, {
      analytics,
      meta: {
        analyticsEvent: "provider_payload",
        analyticsOutcome: "pending",
      },
    });

    expect(analyticsMocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "domain_provisioned",
      {
        feature: "domain_setup",
        outcome: "succeeded",
        site_id: "site-1",
      },
      { sendInstantly: true },
    );
  });
});
