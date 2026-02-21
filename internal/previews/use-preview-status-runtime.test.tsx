// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPreviewStatusCenterRequestKey,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  markPreviewStatusCenterJobTerminal,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
} from "./status-center-store";
import {
  resetPreviewStatusRuntimeOwnerForTests,
  usePreviewStatusRuntime,
} from "./use-preview-status-runtime";

function RuntimeHarness() {
  usePreviewStatusRuntime();
  return null;
}

describe("usePreviewStatusRuntime", () => {
  let nextIntervalId = 1;
  let activeIntervals: Set<number>;

  beforeEach(() => {
    window.localStorage.clear();
    resetPreviewStatusCenterStoreForTests();
    resetPreviewStatusRuntimeOwnerForTests();
    nextIntervalId = 1;
    activeIntervals = new Set<number>();

    const realSetInterval = window.setInterval.bind(window);
    const realClearInterval = window.clearInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(
      ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        if (timeout === DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS) {
          const id = nextIntervalId++;
          activeIntervals.add(id);
          void handler;
          void args;
          return id;
        }
        return realSetInterval(handler, timeout, ...(args as []));
      }) as typeof window.setInterval,
    );
    vi.spyOn(window, "clearInterval").mockImplementation(
      ((id: number) => {
        if (activeIntervals.has(id)) {
          activeIntervals.delete(id);
          return;
        }
        realClearInterval(id);
      }) as typeof window.clearInterval,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "processing" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
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
    resetPreviewStatusRuntimeOwnerForTests();
  });

  it("does not create polling interval when there are no active jobs", async () => {
    render(<RuntimeHarness />);

    await waitFor(() => {
      expect(activeIntervals.size).toBe(0);
    });
  });

  it("creates polling interval for active jobs and clears it when jobs become terminal", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "11111111-1111-1111-1111-111111111111",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
    });

    render(<RuntimeHarness />);

    await waitFor(() => {
      expect(activeIntervals.size).toBe(1);
    });

    markPreviewStatusCenterJobTerminal("11111111-1111-1111-1111-111111111111", "ready");

    await waitFor(() => {
      expect(activeIntervals.size).toBe(0);
    });
  });

  it("enforces singleton ownership when mounted multiple times", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    upsertPreviewStatusCenterJob({
      previewId: "22222222-2222-2222-2222-222222222222",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
    });

    render(
      <>
        <RuntimeHarness />
        <RuntimeHarness />
      </>,
    );

    await waitFor(() => {
      expect(activeIntervals.size).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("releases intervals on unmount and keeps a single active loop after remount", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "33333333-3333-3333-3333-333333333333",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
    });

    const first = render(<RuntimeHarness />);
    await waitFor(() => {
      expect(activeIntervals.size).toBe(1);
    });

    first.unmount();
    await waitFor(() => {
      expect(activeIntervals.size).toBe(0);
    });

    render(<RuntimeHarness />);
    await waitFor(() => {
      expect(activeIntervals.size).toBe(1);
    });
  });
});
