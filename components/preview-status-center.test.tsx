// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import {
  buildPreviewStatusCenterRequestKey,
  markPreviewStatusCenterJobTerminal,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
  writeActivePreviewIdToSession,
} from "@internal/previews/status-center-store";

const messages = {
  "try.center.capacityHint": "Capacity hint",
  "try.center.providerCapacityHint": "Provider capacity hint",
  "try.stage.fetching_page": "Fetching page",
  "try.stage.analyzing_content": "Analyzing content",
  "try.stage.translating": "Translating",
  "try.stage.generating_preview": "Generating preview",
  "try.stage.saving": "Saving",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity",
  "try.status.restoring": "Checking preview status...",
} as const;

function upsertJob(options: {
  previewId: string;
  sourceUrl: string;
  status: "pending" | "processing" | "waiting_provider_capacity";
  stage?: "translating";
  retryHint?: { reason: "browser_capacity_exhausted" | "provider_capacity_wait" };
}) {
  upsertPreviewStatusCenterJob({
    previewId: options.previewId,
    requestKey: buildPreviewStatusCenterRequestKey({
      sourceUrl: options.sourceUrl,
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    }),
    statusToken: "status-token",
    sourceUrl: options.sourceUrl,
    sourceLang: "en",
    targetLang: "fr",
    status: options.status,
    stage: options.stage ?? null,
    retryHint: options.retryHint ? { ...options.retryHint, retryAfterSeconds: 30 } : null,
  });
}

beforeEach(() => {
  resetPreviewStatusCenterStoreForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPreviewStatusCenterStoreForTests();
});

describe("PreviewStatusCenter", () => {
  it("renders the single active job from the shared store", async () => {
    upsertJob({
      previewId: "11111111-1111-1111-1111-111111111111",
      sourceUrl: "https://example.com",
      status: "pending",
      stage: "translating",
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Translating")).toBeTruthy();
      expect(screen.getByText("example.com")).toBeTruthy();
    });
  });

  it("renders nothing when there is no active job", async () => {
    upsertJob({
      previewId: "22222222-2222-2222-2222-222222222222",
      sourceUrl: "https://ready.example.com",
      status: "pending",
    });
    markPreviewStatusCenterJobTerminal("22222222-2222-2222-2222-222222222222", "ready", {
      previewUrl: "https://preview.example.com/p/ready",
    });

    const { container } = render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("prefers the session-pinned active job over other active jobs", async () => {
    upsertJob({
      previewId: "33333333-3333-3333-3333-333333333333",
      sourceUrl: "https://other.example.com",
      status: "processing",
    });
    upsertJob({
      previewId: "44444444-4444-4444-4444-444444444444",
      sourceUrl: "https://pinned.example.com",
      status: "pending",
    });
    writeActivePreviewIdToSession("44444444-4444-4444-4444-444444444444");

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("pinned.example.com")).toBeTruthy();
      expect(screen.queryByText("other.example.com")).toBeNull();
    });
  });

  it("switches to the newly pinned job when the pin changes after mount", async () => {
    upsertJob({
      previewId: "33333333-3333-3333-3333-333333333333",
      sourceUrl: "https://other.example.com",
      status: "processing",
    });
    upsertJob({
      previewId: "44444444-4444-4444-4444-444444444444",
      sourceUrl: "https://pinned.example.com",
      status: "pending",
    });
    writeActivePreviewIdToSession("33333333-3333-3333-3333-333333333333");

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("other.example.com")).toBeTruthy();
    });

    // Re-pinning in the same tab must re-render without any store change.
    writeActivePreviewIdToSession("44444444-4444-4444-4444-444444444444");

    await waitFor(() => {
      expect(screen.getByText("pinned.example.com")).toBeTruthy();
      expect(screen.queryByText("other.example.com")).toBeNull();
    });
  });

  it("renders a capacity hint for jobs waiting on browser slots", async () => {
    upsertJob({
      previewId: "55555555-5555-5555-5555-555555555555",
      sourceUrl: "https://capacity.example.com",
      status: "processing",
      retryHint: { reason: "browser_capacity_exhausted" },
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Capacity hint")).toBeTruthy();
    });
  });

  it("renders a capacity hint for jobs waiting on provider capacity", async () => {
    upsertJob({
      previewId: "66666666-6666-6666-6666-666666666666",
      sourceUrl: "https://provider-capacity.example.com",
      status: "waiting_provider_capacity",
      retryHint: { reason: "provider_capacity_wait" },
    });

    render(<PreviewStatusCenter messages={messages} />);

    await waitFor(() => {
      expect(screen.getByText("Waiting for translation capacity")).toBeTruthy();
      expect(screen.getByText("Provider capacity hint")).toBeTruthy();
    });
  });
});
