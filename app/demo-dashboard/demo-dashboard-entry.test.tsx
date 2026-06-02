// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@internal/i18n/messages/en.json";
import { DemoDashboardEntry } from "./demo-dashboard-entry";

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
    vi.useRealTimers();
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
    const fetchMock = vi.fn(async () => jsonResponse(claimPayload("ps-demo")));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DemoDashboardEntry accessToken={["demo-token", "ignored-token"]} messages={messages} />,
    );

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
      target: { value: "owner@example.com" },
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
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );
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
    expect(await screen.findByText(/Payment recovery is required/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();
    expect(screen.queryByText("Activation started")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores conversion responses that resolve after demo access expires", async () => {
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
    expect(screen.getByText("Demo access has expired.")).toBeTruthy();

    await act(async () => {
      resolveConversion(jsonResponse(conversionPayload("converted")));
      await Promise.resolve();
    });

    expect(screen.getByText("Demo access has expired.")).toBeTruthy();
    expect(screen.queryByText("Activation started")).toBeNull();
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:conversion:v1")).toBeNull();
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
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();

    unmount();
    fetchMock.mockClear();
    render(<DemoDashboardEntry accessToken="" messages={messages} />);

    await screen.findByText("Payment required");
    expect(screen.getByText("ps-checkout")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish on my domain" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
