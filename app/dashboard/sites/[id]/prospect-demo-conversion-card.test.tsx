// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProspectDemoConversionCard,
  type ProspectDemoConversionCardCopy,
} from "./prospect-demo-conversion-card";

const convertProspectDemoAction = vi.hoisted(() => vi.fn());

vi.mock("./prospect-demo-actions", () => ({
  convertProspectDemoAction,
}));

const copy: ProspectDemoConversionCardCopy = {
  title: "Activate this demo",
  description: "Create the locked starter account.",
  emailLabel: "Work email",
  emailPlaceholder: "owner@example.com",
  submitLabel: "Continue",
  pendingLabel: "Activating...",
  successTitle: "Activation started",
  errorTitle: "Activation unavailable",
  openActivationLinkLabel: "Open activation link",
  messages: {
    siteRequired: "Site ID is required.",
    invalidEmail: "Enter a valid email address.",
    sessionExpired: "Demo dashboard access has expired. Open the demo link again.",
    siteMismatch: "This demo session can only activate its claimed site.",
    unexpectedScope: "Demo conversion returned an unexpected account or site.",
    activationInviteCreated: "Activation invite created.",
    demoActivated: "Demo activated.",
    activationPending: "Activation is pending.",
    paymentFailed: "Payment could not be completed.",
    checkoutPending: "Activation checkout is pending.",
    notFound: "This demo is no longer available.",
    conflict: "This demo cannot be activated yet.",
    timeout: "Activation timed out. Try again in a moment.",
    unavailable: "Activation is unavailable right now.",
    unknown: "Unable to activate this demo right now.",
  },
  nextActions: {
    complete_payment: "Request activation link",
    retry_payment: "Request payment link",
    wait_for_activation: "Refresh activation status",
    open_dashboard: "Open dashboard",
    default: "Continue activation",
  },
};

describe("ProspectDemoConversionCard", () => {
  afterEach(() => {
    cleanup();
    convertProspectDemoAction.mockReset();
  });

  it("exposes the backend next action when conversion succeeds without an invite link", async () => {
    convertProspectDemoAction.mockResolvedValue({
      ok: true,
      messageKey: "paymentFailed",
      message: "Payment could not be completed.",
      meta: {
        status: "payment_failed",
        activationStatus: "payment_failed",
        locked: true,
        lockedReason: "payment_required",
        nextAction: "retry_payment",
        email: "owner@example.com",
      },
    });

    render(<ProspectDemoConversionCard copy={copy} siteId="site-demo" />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Payment could not be completed.");
    expect(screen.getByRole("button", { name: "Request payment link" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Request payment link" }));

    await waitFor(() => {
      expect(convertProspectDemoAction).toHaveBeenCalledTimes(2);
    });
    const retryFormData = convertProspectDemoAction.mock.calls[1]?.[1] as FormData | undefined;
    expect(retryFormData?.get("siteId")).toBe("site-demo");
    expect(retryFormData?.get("email")).toBe("owner@example.com");
  });
});
