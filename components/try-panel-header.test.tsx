// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_PREVIEW_SESSION_STORAGE_KEY,
  buildPreviewStatusCenterRequestKey,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
} from "@internal/previews/status-center-store";
import { TryPanelHeader } from "./try-panel-header";

const messages = {
  "try.header.title": "Try WebLingo",
  "try.header.description": "Create a preview",
  "try.status.capacityHint": "Capacity hint",
  "try.status.providerCapacityHint": "Provider capacity hint",
  "try.status.processingHint": "Processing hint",
  "try.status.processing": "Processing",
  "try.status.pending": "Pending",
  "try.status.restoring": "Checking preview status...",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity",
  "try.stage.translating": "Translating",
} as const;

beforeEach(() => {
  resetPreviewStatusCenterStoreForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPreviewStatusCenterStoreForTests();
});

describe("TryPanelHeader", () => {
  it("shows running copy for a fresh active preview", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "fresh-1111-1111-1111-111111111111",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://fresh.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "fresh-token",
      sourceUrl: "https://fresh.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
      stage: "translating",
      remoteStatusVerified: true,
    });

    render(<TryPanelHeader messages={messages} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Translating" })).toBeTruthy();
      expect(screen.getByText("Processing hint")).toBeTruthy();
    });
  });

  it("ignores stale active previews when choosing header copy", async () => {
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "stale-2222-2222-2222-222222222222",
          requestKey: buildPreviewStatusCenterRequestKey({
            sourceUrl: "https://stale.example.com",
            sourceLang: "en",
            targetLang: "fr",
          }),
          statusToken: "stale-token",
          sourceUrl: "https://stale.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "processing",
          stage: "translating",
          previewUrl: null,
          error: null,
          errorCode: null,
          errorStage: null,
          remoteStatusVerified: true,
          createdAt: now - 60 * 60 * 1000,
          updatedAt: now,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: now + 5_000,
        },
      ]),
    );

    render(<TryPanelHeader messages={messages} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Try WebLingo" })).toBeTruthy();
      expect(screen.getByText("Create a preview")).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Translating" })).toBeNull();
  });

  it("keeps showing stale active previews when they are pinned to the current tab", async () => {
    const now = Date.now();
    const previewId = "pinned-3333-3333-3333-333333333333";
    window.sessionStorage.setItem(ACTIVE_PREVIEW_SESSION_STORAGE_KEY, previewId);
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId,
          requestKey: buildPreviewStatusCenterRequestKey({
            sourceUrl: "https://pinned.example.com",
            sourceLang: "en",
            targetLang: "fr",
          }),
          statusToken: "pinned-token",
          sourceUrl: "https://pinned.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "processing",
          stage: "translating",
          previewUrl: null,
          error: null,
          errorCode: null,
          errorStage: null,
          createdAt: now - 60 * 60 * 1000,
          updatedAt: now,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: now + 5_000,
        },
      ]),
    );

    render(<TryPanelHeader messages={messages} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Checking preview status..." })).toBeTruthy();
      expect(screen.getByText("Processing hint")).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Try WebLingo" })).toBeNull();
  });

  it("shows translation-capacity guidance in the running header", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "capacity-4444-4444-4444-444444444444",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://capacity.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "capacity-token",
      sourceUrl: "https://capacity.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 60,
        emailRecommended: false,
      },
      remoteStatusVerified: true,
    });

    render(<TryPanelHeader messages={messages} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Waiting for translation capacity" }),
      ).toBeTruthy();
      expect(screen.getByText("Provider capacity hint")).toBeTruthy();
    });
    expect(screen.queryByText("Processing hint")).toBeNull();
  });
});
