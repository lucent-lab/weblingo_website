// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AuthFormState = { error: string | null; notice: string | null };

const mocks = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
}));

vi.mock("@/app/auth/login/actions", () => ({
  login: mocks.login,
  signup: mocks.signup,
}));

vi.mock("@internal/analytics/client", () => ({
  ANALYTICS_EVENTS: {
    authSubmitted: "auth_submitted",
    authViewed: "auth_viewed",
  },
  captureAnalyticsEvent: mocks.captureAnalyticsEvent,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: (action: unknown) =>
      [{ error: null, notice: null } satisfies AuthFormState, action, false] as const,
  };
});

import { AuthLoginForm } from "./auth-login-form";

describe("AuthLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("sends auth submit analytics immediately", () => {
    const { container } = render(<AuthLoginForm />);
    mocks.captureAnalyticsEvent.mockClear();

    const loginButton = screen.getByRole("button", { name: "Log in" });
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    Object.defineProperty(submitEvent, "submitter", { value: loginButton });
    fireEvent(container.querySelector("form")!, submitEvent);

    expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "auth_submitted",
      {
        app_surface: "auth",
        auth_action: "login",
        auth_method: "password",
        feature: "dashboard_auth",
        outcome: "submitted",
      },
      { sendInstantly: true },
    );
  });
});
