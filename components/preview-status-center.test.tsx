// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import {
  buildPreviewStatusCenterRequestKey,
  markPreviewStatusCenterJobTerminal,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
} from "@internal/previews/status-center-store";

const messages = {
  "try.center.dismiss": "Dismiss",
  "try.center.retryHint": "Retry hint",
  "try.error.default": "Preview failed",
  "try.error.preview_expired": "Preview expired",
  "try.error.preview_not_found": "Preview not found",
  "try.error.unknown": "Unknown error",
  "try.preview.open": "Open preview",
  "try.stage.fetching_page": "Fetching page",
  "try.stage.analyzing_content": "Analyzing content",
  "try.stage.translating": "Translating",
  "try.stage.generating_preview": "Generating preview",
  "try.stage.saving": "Saving",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing",
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

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Ready")).toBeNull();
    });
  });
});
