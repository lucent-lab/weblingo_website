// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@internal/i18n/messages/en.json";
import { DemoDashboardEntry } from "./demo-dashboard-entry";

const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsState.value,
}));

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
    searchParamsState.value = new URLSearchParams();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("claims a hash token, scrubs the URL, and enters the real dashboard site page", async () => {
    window.history.replaceState(null, "", "/dashboard/demo?source=mail#token=fragment-token");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ demo: true, redirectUrl: "/dashboard/sites/site-demo" }),
    );
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} navigate={navigate} />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard/sites/site-demo");
    });
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
    expect(window.sessionStorage.length).toBe(0);
  });

  it("uses a query token from Next search params without persisting dashboard credentials", async () => {
    searchParamsState.value = new URLSearchParams("token=query-token");
    window.history.replaceState(null, "", "/dashboard/demo?token=query-token");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ demo: true, redirectUrl: "/dashboard/sites/site-query" }),
    );
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} navigate={navigate} />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard/sites/site-query");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prospect-showcases/claim",
      expect.objectContaining({
        body: JSON.stringify({ token: "query-token" }),
      }),
    );
    expect(window.sessionStorage.getItem("weblingo:demo-dashboard:claim:v1")).toBeNull();
  });

  it("renders an error when the claim response is invalid", async () => {
    window.history.replaceState(null, "", "/dashboard/demo#token=fragment-token");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ demo: true, redirectUrl: "/demo-dashboard" }),
    );
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} navigate={navigate} />);

    await screen.findByText("Demo access response was invalid.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not call claim without a token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} navigate={vi.fn()} />);

    await screen.findByText("Missing demo access token.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests a fresh access link from the missing-token error state", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        message: "If this demo is eligible, we'll email a fresh access link.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoDashboardEntry messages={messages} navigate={vi.fn()} />);

    await screen.findByText("Missing demo access token.");
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send access link" }));

    await screen.findByText("If this demo is eligible, we'll email a fresh access link.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prospect-showcases/access-link/resend",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );
  });
});
