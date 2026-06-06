// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "../../actions";

const mocks = vi.hoisted(() => ({
  formAction: vi.fn(),
  push: vi.fn(),
}));

let mockState: ActionResponse = { ok: false, message: "" };

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
    useActionState: () => [mockState, mocks.formAction, false] as const,
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

import { OnboardingForm } from "./onboarding-form";

describe("OnboardingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = { ok: false, message: "" };
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
});
