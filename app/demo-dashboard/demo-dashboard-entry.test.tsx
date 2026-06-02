// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@internal/i18n/messages/en.json";
import { DemoDashboardEntry } from "./demo-dashboard-entry";

function claimPayload(ref: string) {
  return {
    token: `dashboard-${ref}`,
    expiresAt: "2026-06-02T12:00:00.000Z",
    prospectShowcaseRef: ref,
    siteId: `site-${ref}`,
    conversionToken: `conversion-${ref}`,
    demo: true,
  };
}

function conversionPayload(
  status: "checkout_pending" | "activation_pending" | "payment_failed" | "converted",
) {
  return {
    prospectShowcaseRef: "ps-payment",
    status,
    activationStatus: status === "converted" ? "active" : status,
    locked: status !== "converted",
    lockedReason: status === "converted" ? "none" : "payment_required",
    accountId: "acct-customer",
    siteId: "site-customer",
    nextAction: status === "payment_failed" ? "retry_payment" : "complete_payment",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DemoDashboardEntry", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("scrubs the URL token and sends the local claim request with a JSON body", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-demo")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await screen.findByText("ps-demo");
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("#open");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "demo-token" }),
      }),
    );
  });

  it("restores the claimed demo session after the URL token is scrubbed", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token#open");
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-session")));
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await screen.findByText("ps-session");
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    fetchMock.mockClear();
    render(<DemoDashboardEntry accessToken="" messages={messages} />);

    await screen.findByText("ps-session");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the URL token when the claim exchange fails", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    const fetchMock = vi.fn(async () => jsonResponse({ error: "temporary failure" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await screen.findByText("temporary failure");
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?token=demo-token&source=mail");
    expect(window.location.hash).toBe("#open");
  });

  it("keeps the URL token and clears stale storage when a successful claim response is invalid", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    window.sessionStorage.setItem(
      "weblingo:demo-dashboard:claim:v1",
      JSON.stringify(claimPayload("ps-stale")),
    );
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await screen.findByText("Demo access response was invalid.");
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?token=demo-token&source=mail");
    expect(window.location.hash).toBe("#open");
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:claim:v1")).toBeNull();
  });

  it("clears stale claim and conversion state when the token changes", async () => {
    let resolveSecondClaim: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { token?: string };
        if (body.token === "first-token") {
          return Promise.resolve(jsonResponse(claimPayload("ps-first")));
        }
        return new Promise<Response>((resolve) => {
          resolveSecondClaim = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ status: "checkout_pending" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <DemoDashboardEntry accessToken="first-token" messages={messages} />,
    );
    await screen.findByText("ps-first");

    rerender(<DemoDashboardEntry accessToken="second-token" messages={messages} />);

    await waitFor(() => {
      expect(screen.queryByText("ps-first")).toBeNull();
      expect(screen.getByText("Opening demo workspace...")).toBeTruthy();
    });
    resolveSecondClaim(jsonResponse(claimPayload("ps-second")));
    await screen.findByText("ps-second");
  });

  it("renders the backend conversion status instead of treating every 2xx as activated", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(jsonResponse(claimPayload("ps-payment")));
      }
      return Promise.resolve(jsonResponse(conversionPayload("payment_failed")));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await screen.findByText("ps-payment");

    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));

    expect(await screen.findByText("Payment failed")).toBeTruthy();
    expect(await screen.findByText(/Retry payment to unlock activation\./)).toBeTruthy();
    expect(screen.queryByText("Activation started")).toBeNull();
  });
});
