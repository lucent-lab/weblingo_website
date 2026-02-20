// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getPreviewStatusCenterSnapshot,
  hydratePreviewStatusCenterStore,
  markPreviewStatusCenterJobTerminal,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  removePreviewStatusCenterJob,
  resetPreviewStatusCenterJobRetry,
  resetPreviewStatusCenterStoreForTests,
  setPreviewStatusCenterJobRetry,
  upsertPreviewStatusCenterJob,
} from "./status-center-store";

function buildJob() {
  return {
    previewId: "11111111-1111-1111-1111-111111111111",
    statusToken: "status-token",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    targetLang: "fr",
    status: "pending" as const,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  resetPreviewStatusCenterStoreForTests();
});

describe("status-center-store", () => {
  it("persists and hydrates preview jobs from localStorage", () => {
    upsertPreviewStatusCenterJob(buildJob());

    const stored = window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const beforeReset = getPreviewStatusCenterSnapshot();
    expect(beforeReset.jobs).toHaveLength(1);
    expect(beforeReset.jobs[0].previewId).toBe("11111111-1111-1111-1111-111111111111");

    resetPreviewStatusCenterStoreForTests();
    hydratePreviewStatusCenterStore();

    const afterHydrate = getPreviewStatusCenterSnapshot();
    expect(afterHydrate.jobs).toHaveLength(1);
    expect(afterHydrate.jobs[0].sourceUrl).toBe("https://example.com");
  });

  it("marks a job terminal and supports dismissing it", () => {
    upsertPreviewStatusCenterJob(buildJob());
    markPreviewStatusCenterJobTerminal("11111111-1111-1111-1111-111111111111", "ready", {
      previewUrl: "https://preview.test/abc",
    });

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0].status).toBe("ready");
    expect(snapshot.jobs[0].previewUrl).toBe("https://preview.test/abc");

    removePreviewStatusCenterJob("11111111-1111-1111-1111-111111111111");
    expect(getPreviewStatusCenterSnapshot().jobs).toHaveLength(0);
  });

  it("tracks and resets retry state for active jobs", () => {
    upsertPreviewStatusCenterJob(buildJob());
    const now = Date.now();
    setPreviewStatusCenterJobRetry("11111111-1111-1111-1111-111111111111", 2, 12_000);

    let snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs[0].retryCount).toBe(2);
    expect(snapshot.jobs[0].nextPollAt).toBeGreaterThanOrEqual(now + 11_000);

    resetPreviewStatusCenterJobRetry("11111111-1111-1111-1111-111111111111");
    snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs[0].retryCount).toBe(0);
    expect(snapshot.jobs[0].nextPollAt).toBeGreaterThan(Date.now());
  });
});
