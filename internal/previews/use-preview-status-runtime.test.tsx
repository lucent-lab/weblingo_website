// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPreviewStatusCenterRequestKey,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterJobsSnapshot,
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
    vi.spyOn(window, "setInterval").mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS) {
        const id = nextIntervalId++;
        activeIntervals.add(id);
        void handler;
        void args;
        return id;
      }
      return realSetInterval(handler, timeout, ...(args as []));
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(((id: number) => {
      if (activeIntervals.has(id)) {
        activeIntervals.delete(id);
        return;
      }
      realClearInterval(id);
    }) as typeof window.clearInterval);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
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

  it("stores retry hints from status polling while a preview stays active", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "processing",
              stage: "fetching_page",
              retryHint: {
                reason: "browser_capacity_exhausted",
                retryAfterSeconds: 60,
                emailRecommended: true,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    upsertPreviewStatusCenterJob({
      previewId: "44444444-4444-4444-4444-444444444444",
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
      nextPollAt: 0,
    });

    render(<RuntimeHarness />);

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "44444444-4444-4444-4444-444444444444",
      );
      expect(job?.retryHint).toEqual({
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 60,
        emailRecommended: true,
      });
    });
  });

  it("uses provider-capacity retry hints as the next active poll delay", async () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "waiting_provider_capacity",
              stage: "translating",
              retryHint: {
                reason: "provider_capacity_wait",
                retryAfterSeconds: 2,
                emailRecommended: true,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    upsertPreviewStatusCenterJob({
      previewId: "capacity-7777-7777-7777-777777777777",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "waiting_provider_capacity",
      nextPollAt: 0,
    });

    const beforePoll = Date.now();
    render(<RuntimeHarness />);

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "capacity-7777-7777-7777-777777777777",
      );
      expect(job?.retryHint).toEqual({
        reason: "provider_capacity_wait",
        retryAfterSeconds: 2,
        emailRecommended: true,
      });
      expect(job?.nextPollAt).toBeGreaterThanOrEqual(beforePoll + 2_000);
      expect(job?.nextPollAt).toBeLessThan(
        beforePoll + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
      );
      expect(
        timeoutSpy.mock.calls.some(([, delay]) => {
          return (
            typeof delay === "number" &&
            delay >= 1_500 &&
            delay < DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS
          );
        }),
      ).toBe(true);
    });
  });

  it("preserves provider-capacity state during transient status failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const beforePoll = Date.now();

    upsertPreviewStatusCenterJob({
      previewId: "capacity-transient-7777-7777-7777-777777777777",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "token",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: true,
      },
      nextPollAt: 0,
    });

    render(<RuntimeHarness />);

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "capacity-transient-7777-7777-7777-777777777777",
      );
      expect(job?.status).toBe("waiting_provider_capacity");
      expect(job?.stage).toBe("translating");
      expect(job?.retryHint).toEqual({
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: true,
      });
      expect(job?.remoteStatusVerified).toBe(false);
      expect(job?.retryCount).toBe(1);
      expect(job?.nextPollAt).toBeGreaterThanOrEqual(beforePoll + 30_000);
    });
  });

  it("keeps empty successful status responses unverified and schedules a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 200,
          }),
      ),
    );

    upsertPreviewStatusCenterJob({
      previewId: "55555555-5555-5555-5555-555555555555",
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
      nextPollAt: 0,
      remoteStatusVerified: false,
    });

    render(<RuntimeHarness />);

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "55555555-5555-5555-5555-555555555555",
      );
      expect(job?.status).toBe("processing");
      expect(job?.remoteStatusVerified).toBe(false);
      expect(job?.retryCount).toBe(1);
      expect(job?.nextPollAt).toBeGreaterThan(Date.now());
    });
  });

  it("terminalizes restored jobs after repeated transient status failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    upsertPreviewStatusCenterJob({
      previewId: "66666666-6666-6666-6666-666666666666",
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
      retryCount: 4,
      nextPollAt: 0,
      remoteStatusVerified: false,
    });

    render(<RuntimeHarness />);

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "66666666-6666-6666-6666-666666666666",
      );
      expect(job?.status).toBe("failed");
      expect(job?.errorCode).toBe("unknown");
      expect(job?.remoteStatusVerified).toBe(true);
    });
  });
});
