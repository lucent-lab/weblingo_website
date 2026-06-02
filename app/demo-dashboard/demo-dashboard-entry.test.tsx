// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@internal/i18n/messages/en.json";
import { DemoDashboardEntry } from "./demo-dashboard-entry";

const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsState.value,
}));

function claimPayload(ref: string, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  return {
    token: `dashboard-${ref}`,
    expiresAt,
    prospectShowcaseRef: ref,
    siteId: `site-${ref}`,
    conversionToken: `conversion-${ref}`,
    demo: true,
  };
}

function conversionPayload(
  status: "checkout_pending" | "activation_pending" | "payment_failed" | "converted",
  nextAction?: string,
) {
  const nextActionByStatus = {
    checkout_pending: "complete_payment",
    activation_pending: "wait_for_activation",
    payment_failed: "retry_payment",
    converted: "open_dashboard",
  } as const;
  return {
    prospectShowcaseRef: "ps-payment",
    status,
    activationStatus: status === "converted" ? "active" : status,
    locked: status !== "converted",
    lockedReason: status === "converted" ? "none" : "payment_required",
    accountId: "acct-customer",
    siteId: "site-customer",
    nextAction: nextAction ?? nextActionByStatus[status],
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    searchParamsState.value = new URLSearchParams();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("reads query tokens after hydration, scrubs them, and sends a JSON claim request", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-demo")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} />);

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

  it("reads demo access tokens from the URL fragment and scrubs them before exchange", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?source=mail#token=fragment-token");
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-fragment")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="" messages={messages} />);

    await screen.findByText("ps-fragment");
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "fragment-token" }),
      }),
    );
  });

  it("restores a new fragment token after an in-page hash change", async () => {
    window.history.replaceState(null, "", "/dashboard/demo#token=first-fragment-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(claimPayload("ps-first-fragment")))
      .mockResolvedValueOnce(jsonResponse(claimPayload("ps-second-fragment")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="" messages={messages} />);
    await screen.findByText("ps-first-fragment");

    window.history.replaceState(null, "", "/dashboard/demo#token=second-fragment-token");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    await screen.findByText("ps-second-fragment");
    expect(screen.queryByText("ps-first-fragment")).toBeNull();
    expect(window.location.hash).toBe("");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "second-fragment-token" }),
      }),
    );
  });

  it("uses the first token when the URL includes duplicated token params", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&token=ignored-token");
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-demo")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} />);

    await screen.findByText("ps-demo");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "demo-token" }),
      }),
    );
  });

  it("server-renders a loading state while scrubbed sessions wait for client restore", () => {
    const browserWindow = window;
    vi.stubGlobal("window", undefined);
    try {
      const html = renderToString(<DemoDashboardEntry accessToken="" messages={messages} />);
      expect(html).toContain("Opening demo workspace");
      expect(html).not.toContain("Missing demo access token");
    } finally {
      vi.stubGlobal("window", browserWindow);
    }
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

    expect(screen.queryByText("Missing demo access token.")).toBeNull();
    await screen.findByText("ps-session");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expires an open restored claim when its access window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T11:59:59.000Z"));
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(
          jsonResponse(claimPayload("ps-expiring", "2026-06-02T12:00:00.000Z")),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("ps-expiring")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("Demo access has expired.")).toBeTruthy();
    expect(screen.queryByText("ps-expiring")).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:claim:v1")).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:conversion:v1")).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:access-token:v1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry demo access" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: " Owner@Example.COM " },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email fresh link" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("If this demo is eligible, we'll email a fresh access link."),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/prospect-showcases/access-link/resend",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "Owner@Example.COM" }),
      }),
    );
  });

  it("expires a restored conversion result when its access window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T11:59:59.000Z"));
    const claim = claimPayload("ps-payment", "2026-06-02T12:00:00.000Z");
    window.sessionStorage.setItem("weblingo:demo-dashboard:claim:v1", JSON.stringify(claim));
    window.sessionStorage.setItem(
      "weblingo:demo-dashboard:conversion:v1",
      JSON.stringify({
        claimToken: claim.token,
        conversionToken: claim.conversionToken,
        prospectShowcaseRef: claim.prospectShowcaseRef,
        payload: conversionPayload("checkout_pending"),
      }),
    );
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="" messages={messages} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Payment required")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Finish payment/ })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText("Demo access has expired.")).toBeTruthy();
    expect(screen.queryByText("Payment required")).toBeNull();
    expect(screen.queryByRole("link", { name: /Finish payment/ })).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:claim:v1")).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:conversion:v1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scrubs the URL token and keeps a failed claim exchange retryable", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    const fetchMock = vi.fn(async () => jsonResponse({ error: "temporary failure" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await screen.findByText("temporary failure");
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("#open");
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:access-token:v1")).toBe(
      "demo-token",
    );
  });

  it("lets the user retry a failed claim exchange from the stored access token", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?token=demo-token&source=mail#open");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "temporary failure" }, 503))
      .mockResolvedValueOnce(jsonResponse(claimPayload("ps-retry")));
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);

    await screen.findByText("temporary failure");
    expect(window.location.search).toBe("?source=mail");
    fireEvent.click(screen.getByRole("button", { name: "Retry demo access" }));

    await screen.findByText("ps-retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/dashboard/demo");
    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("#open");
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:access-token:v1")).toBeNull();
  });

  it("scrubs the URL token and clears stale storage when a successful claim response is invalid", async () => {
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
    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("#open");
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:access-token:v1")).toBeNull();
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

  it("clears stale claim and conversion state when the route query token changes", async () => {
    searchParamsState.value = new URLSearchParams("token=first-token");
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

    const { rerender } = render(<DemoDashboardEntry messages={messages} />);
    await screen.findByText("ps-first");

    searchParamsState.value = new URLSearchParams("token=second-token");
    rerender(<DemoDashboardEntry messages={messages} />);

    await waitFor(() => {
      expect(screen.queryByText("ps-first")).toBeNull();
      expect(screen.getByText("Opening demo workspace...")).toBeTruthy();
    });
    resolveSecondClaim(jsonResponse(claimPayload("ps-second")));
    await screen.findByText("ps-second");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        body: JSON.stringify({ token: "second-token" }),
      }),
    );
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
      target: { value: " Owner@Example.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));

    expect(await screen.findByText("Payment failed")).toBeTruthy();
    expect(await screen.findByText(/Payment recovery is required/)).toBeTruthy();
    const retryPaymentLink = screen.getByRole("link", { name: /Retry payment/ });
    expect(retryPaymentLink.getAttribute("href")).toBe("/dashboard/sites/site-customer");
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();
    expect(screen.queryByText("Activation started")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/prospect-showcases/ps-payment/convert",
      expect.objectContaining({
        body: JSON.stringify({
          email: "Owner@Example.COM",
          conversionToken: "conversion-ps-payment",
          dashboardToken: "dashboard-ps-payment",
        }),
      }),
    );
  });

  it("renders a customer workspace action after conversion completes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(jsonResponse(claimPayload("ps-converted")));
      }
      return Promise.resolve(jsonResponse(conversionPayload("converted")));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await screen.findByText("ps-converted");
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));

    expect(await screen.findByText("Activation complete")).toBeTruthy();
    const workspaceLink = screen.getByRole("link", { name: /Open customer workspace/ });
    expect(workspaceLink.getAttribute("href")).toBe("/dashboard/sites/site-customer");
  });

  it("renders conversion responses that resolve after demo access expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T11:59:59.000Z"));
    let resolveConversion: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(
          jsonResponse(claimPayload("ps-expiring", "2026-06-02T12:00:00.000Z")),
        );
      }
      return new Promise<Response>((resolve) => {
        resolveConversion = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("ps-expiring")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByText("Demo access has expired.")).toBeNull();

    await act(async () => {
      resolveConversion(jsonResponse(conversionPayload("converted")));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Activation complete")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open customer workspace/ })).toBeTruthy();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:conversion:v1")).toBeTruthy();
  });

  it("renders a workspace action for unknown conversion next actions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(jsonResponse(claimPayload("ps-action")));
      }
      return Promise.resolve(jsonResponse(conversionPayload("checkout_pending", "contact_sales")));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await screen.findByText("ps-action");
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));

    expect(await screen.findByText("Payment required")).toBeTruthy();
    expect(screen.getByText(/Continue with backend action: contact_sales/)).toBeTruthy();
    const workspaceLink = screen.getByRole("link", { name: /Open customer workspace/ });
    expect(workspaceLink.getAttribute("href")).toBe("/dashboard/sites/site-customer");
  });

  it("restores a completed conversion result after reload", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases/claim") {
        return Promise.resolve(jsonResponse(claimPayload("ps-checkout")));
      }
      return Promise.resolve(jsonResponse(conversionPayload("checkout_pending")));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<DemoDashboardEntry accessToken="demo-token" messages={messages} />);
    await screen.findByText("ps-checkout");
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish on my domain" }));
    await screen.findByText("Payment required");
    const finishPaymentLink = screen.getByRole("link", { name: /Finish payment/ });
    expect(finishPaymentLink.getAttribute("href")).toBe("/dashboard/sites/site-customer");
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();

    unmount();
    fetchMock.mockClear();
    render(<DemoDashboardEntry accessToken="" messages={messages} />);

    await screen.findByText("Payment required");
    expect(screen.getByText("ps-checkout")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Finish payment/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
