// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "../../actions";

const mocks = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
  formAction: vi.fn(),
  push: vi.fn(),
}));

let mockState: ActionResponse = { ok: false, message: "" };
let mockPending = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => (props: { id?: string; name?: string }) => (
    <select id={props.id} name={props.name} />
  ),
}));

vi.mock("@internal/dashboard/use-action-toast", () => ({
  useActionToast: ({ formAction }: { formAction: (formData: FormData) => unknown }) => formAction,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [mockState, mocks.formAction, mockPending] as const,
  };
});

vi.mock("../../actions", () => ({
  createSiteAction: vi.fn(),
}));

vi.mock("../target-language-picker", () => ({
  TargetLanguagePicker: () => <div>Target languages</div>,
}));

vi.mock("../webhook-settings-fields", () => ({
  WebhookSettingsFields: () => <div>Webhook settings</div>,
}));

vi.mock("@internal/analytics/client", () => ({
  ANALYTICS_EVENTS: {
    siteCreateFailed: "site_create_failed",
    siteCreated: "site_created",
    siteCreateStarted: "site_create_started",
  },
  captureAnalyticsEvent: mocks.captureAnalyticsEvent,
}));

import { OnboardingForm } from "./onboarding-form";

describe("OnboardingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = { ok: false, message: "" };
    mockPending = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("preserves the explicit dashboard locale after site creation", async () => {
    mockState = { ok: true, message: "Created", meta: { siteId: "site-1" } };

    render(
      <OnboardingForm
        maxLocales={null}
        supportedLanguages={[]}
        displayLocale="fr"
        dashboardLocale="fr"
      />,
    );

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/dashboard/sites/site-1?locale=fr"),
    );
  });

  it("sends started analytics immediately", () => {
    const { container } = render(
      <OnboardingForm
        maxLocales={null}
        supportedLanguages={[]}
        displayLocale="en"
        dashboardLocale={null}
      />,
    );

    fireEvent.submit(container.querySelector("form")!);

    expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "site_create_started",
      {
        app_surface: "dashboard",
        feature: "site_creation",
        form_id: "dashboard_site_onboarding",
        outcome: "started",
        source_lang: undefined,
        target_lang_count: 0,
        target_locale_count: 0,
      },
      { sendInstantly: true },
    );
  });

  it("sends settled analytics immediately before navigation", async () => {
    mockPending = true;
    const rendered = render(
      <OnboardingForm
        maxLocales={null}
        supportedLanguages={[]}
        displayLocale="en"
        dashboardLocale={null}
      />,
    );

    mockPending = false;
    mockState = { ok: true, message: "Created", meta: { siteId: "site-1" } };
    rendered.rerender(
      <OnboardingForm
        maxLocales={null}
        supportedLanguages={[]}
        displayLocale="en"
        dashboardLocale={null}
      />,
    );

    await waitFor(() =>
      expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith(
        "site_created",
        {
          app_surface: "dashboard",
          error_code: undefined,
          feature: "site_creation",
          outcome: "succeeded",
          site_id: "site-1",
          source_lang: undefined,
          target_lang_count: 0,
          target_locale_count: 0,
        },
        { sendInstantly: true },
      ),
    );
  });
});
