// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import { ANALYTICS_EVENTS } from "@internal/analytics/client";
import {
  buildPreviewStatusCenterRequestKey,
  markPreviewStatusCenterJobTerminal,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
} from "@internal/previews/status-center-store";

const { captureAnalyticsEvent } = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
}));
vi.mock("@internal/analytics/client", async () => {
  const actual = await vi.importActual<typeof import("@internal/analytics/client")>(
    "@internal/analytics/client",
  );
  return {
    ...actual,
    captureAnalyticsEvent,
  };
});

const messages = {
  "try.center.capacityHint": "Capacity hint",
  "try.center.providerCapacityHint": "Provider capacity hint",
  "try.center.dismiss": "Dismiss",
  "try.center.retryHint": "Retry hint",
  "try.error.default": "Preview failed",
  "try.error.preview_expired": "Preview expired",
  "try.error.preview_not_found": "Preview not found",
  "try.error.unknown": "Unknown error",
  "try.preview.open": "Open preview",
  "try.preview.openDemoDashboard": "Open demo dashboard",
  "try.stage.fetching_page": "Fetching page",
  "try.stage.analyzing_content": "Analyzing content",
  "try.stage.translating": "Translating",
  "try.stage.generating_preview": "Generating preview",
  "try.stage.saving": "Saving",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity",
  "try.status.restoring": "Checking preview status...",
  "try.status.ready": "Ready",
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resetPreviewStatusCenterStoreForTests();
  window.localStorage.clear();
  captureAnalyticsEvent.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      jsonResponse({
        status: "processing",
        stage: "translating",
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetPreviewStatusCenterStoreForTests();
});

describe("PreviewStatusCenter", () => {
  it("renders jobs from the shared store", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "11111111-1111-1111-1111-111111111111",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "status-token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "pending",
      stage: "translating",
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Translating")).toBeTruthy();
      expect(screen.getByText("example.com")).toBeTruthy();
    });
  });

  it("dismisses terminal jobs", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "22222222-2222-2222-2222-222222222222",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://ready.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "ready-token",
      sourceUrl: "https://ready.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "pending",
    });
    markPreviewStatusCenterJobTerminal("22222222-2222-2222-2222-222222222222", "ready", {
      previewUrl: "https://preview.example.com/p/ready",
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Open preview" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
    });

    const openPreviewLink = screen.getByRole("link", { name: "Open preview" });
    openPreviewLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(openPreviewLink);
    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.previewStatusCenterOpenClicked,
      expect.objectContaining({
        preview_id: "22222222-2222-2222-2222-222222222222",
        status: "ready",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.previewStatusCenterDismissed,
      expect.objectContaining({
        preview_id: "22222222-2222-2222-2222-222222222222",
        status: "ready",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Ready")).toBeNull();
    });
  });

  it("opens demo dashboards for ready jobs without preview urls", async () => {
    upsertPreviewStatusCenterJob({
      kind: "prospect_showcase",
      previewId: "55555555-5555-5555-5555-555555555555",
      requestKey: buildPreviewStatusCenterRequestKey({
        kind: "prospect_showcase",
        sourceUrl: "https://demo-only.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "owner@example.com",
      }),
      statusToken: "demo-ready-token",
      sourceUrl: "https://demo-only.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "pending",
    });
    markPreviewStatusCenterJobTerminal("55555555-5555-5555-5555-555555555555", "ready", {
      previewUrl: null,
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=demo-token",
    });

    render(<PreviewStatusCenter messages={messages} />);

    const demoDashboardLink = await screen.findByRole("link", {
      name: "Open demo dashboard",
    });
    expect(demoDashboardLink.getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo#token=demo-token",
    );
    expect(screen.queryByRole("link", { name: "Open preview" })).toBeNull();

    demoDashboardLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(demoDashboardLink);
    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.previewStatusCenterOpenClicked,
      expect.objectContaining({
        preview_id: "55555555-5555-5555-5555-555555555555",
        status: "ready",
      }),
    );
  });

  it("opens demo dashboards for failed payment jobs", async () => {
    upsertPreviewStatusCenterJob({
      kind: "prospect_showcase",
      previewId: "66666666-6666-6666-6666-666666666666",
      requestKey: buildPreviewStatusCenterRequestKey({
        kind: "prospect_showcase",
        sourceUrl: "https://payment-failed.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "owner@example.com",
      }),
      statusToken: "payment-failed-token",
      sourceUrl: "https://payment-failed.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "pending",
    });
    markPreviewStatusCenterJobTerminal("66666666-6666-6666-6666-666666666666", "failed", {
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=payment-retry",
      error: "Payment failed. Retry checkout to continue activation.",
    });

    render(<PreviewStatusCenter messages={messages} />);

    const demoDashboardLink = await screen.findByRole("link", {
      name: "Open demo dashboard",
    });
    expect(demoDashboardLink.getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo#token=payment-retry",
    );

    demoDashboardLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(demoDashboardLink);
    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.previewStatusCenterOpenClicked,
      expect.objectContaining({
        preview_id: "66666666-6666-6666-6666-666666666666",
        status: "failed",
      }),
    );
  });

  it("renders a capacity hint for active jobs waiting on browser slots", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "33333333-3333-3333-3333-333333333333",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://capacity.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "capacity-token",
      sourceUrl: "https://capacity.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
      retryHint: {
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 60,
        emailRecommended: true,
      },
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Capacity hint")).toBeTruthy();
    });
  });

  it("renders a capacity hint for active jobs waiting on provider capacity", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "44444444-4444-4444-4444-444444444444",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://provider-capacity.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "provider-capacity-token",
      sourceUrl: "https://provider-capacity.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "waiting_provider_capacity",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: false,
      },
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Waiting for translation capacity")).toBeTruthy();
      expect(screen.getByText("Provider capacity hint")).toBeTruthy();
    });
  });
});
