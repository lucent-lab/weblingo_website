// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPreviewStatusCenterRequestKey,
  comparePreviewStatusCenterJobs,
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  getPreviewStatusCenterServerSnapshot,
  getPreviewStatusCenterSnapshot,
  hydratePreviewStatusCenterStore,
  LEGACY_PENDING_PREVIEW_STORAGE_KEY,
  LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY,
  markPreviewStatusCenterJobTerminal,
  parsePreviewStatusCenterRequestKey,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  removePreviewStatusCenterJob,
  resetPreviewStatusCenterJobRetry,
  resetPreviewStatusCenterStoreForTests,
  RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS,
  selectPreferredPreviewStatusCenterJob,
  selectLatestActivePreviewStatusCenterJob,
  selectLatestJobByRequestKey,
  selectRestorablePreviewStatusCenterJob,
  setPreviewStatusCenterJobRetry,
  upsertPreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "./status-center-store";

function buildJob(overrides: Partial<Parameters<typeof upsertPreviewStatusCenterJob>[0]> = {}) {
  return {
    previewId: "11111111-1111-1111-1111-111111111111",
    requestKey: buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "",
    }),
    statusToken: "status-token",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    targetLang: "fr",
    status: "pending" as const,
    retryHint: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  resetPreviewStatusCenterStoreForTests();
});

describe("status-center-store", () => {
  it("returns a stable server snapshot reference", () => {
    const first = getPreviewStatusCenterServerSnapshot();
    const second = getPreviewStatusCenterServerSnapshot();
    expect(first).toBe(second);
    expect(first.jobs).toBe(second.jobs);

    const serverJobsFirst = getPreviewStatusCenterServerJobsSnapshot();
    const serverJobsSecond = getPreviewStatusCenterServerJobsSnapshot();
    expect(serverJobsFirst).toBe(serverJobsSecond);
  });

  it("persists and hydrates preview jobs from v2 localStorage", () => {
    upsertPreviewStatusCenterJob(buildJob());

    const stored = window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY);
    expect(stored).toBeTruthy();

    const beforeReset = getPreviewStatusCenterSnapshot();
    expect(beforeReset.jobs).toHaveLength(1);
    expect(beforeReset.jobs[0].previewId).toBe("11111111-1111-1111-1111-111111111111");
    expect(getPreviewStatusCenterJobsSnapshot()).toBe(beforeReset.jobs);
    const persistedNextPollAt = beforeReset.jobs[0].nextPollAt;

    resetPreviewStatusCenterStoreForTests();
    hydratePreviewStatusCenterStore();

    const afterHydrate = getPreviewStatusCenterSnapshot();
    expect(afterHydrate.jobs).toHaveLength(1);
    expect(afterHydrate.jobs[0].sourceUrl).toBe("https://example.com");
    expect(afterHydrate.jobs[0].nextPollAt).toBe(persistedNextPollAt);
    expect(afterHydrate.jobs[0].remoteStatusVerified).toBe(false);
  });

  it("derives active polling from retry hints when no explicit poll time exists", () => {
    const now = Date.now();
    upsertPreviewStatusCenterJob(
      buildJob({
        status: "waiting_provider_capacity",
        retryHint: {
          reason: "provider_capacity_wait",
          retryAfterSeconds: 30,
          emailRecommended: true,
        },
      }),
    );

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs[0].nextPollAt).toBeGreaterThanOrEqual(now + 30_000);

    const stored = JSON.parse(
      String(window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)),
    ) as Array<Record<string, unknown>>;
    delete stored[0].nextPollAt;
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(stored));

    resetPreviewStatusCenterStoreForTests();
    hydratePreviewStatusCenterStore();

    const afterHydrate = getPreviewStatusCenterSnapshot();
    expect(afterHydrate.jobs[0].nextPollAt).toBeGreaterThanOrEqual(now + 30_000);
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

  it("does not downgrade active status on reconnect upserts", () => {
    upsertPreviewStatusCenterJob(
      buildJob({
        status: "processing",
        stage: "translating",
      }),
    );

    upsertPreviewStatusCenterJob(
      buildJob({
        sourceUrl: "",
        sourceLang: "",
        targetLang: "",
        status: "pending",
      }),
    );

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0].status).toBe("processing");
    expect(snapshot.jobs[0].sourceUrl).toBe("https://example.com");
    expect(snapshot.jobs[0].sourceLang).toBe("en");
    expect(snapshot.jobs[0].targetLang).toBe("fr");
    expect(snapshot.jobs[0].stage).toBe("translating");
  });

  it("migrates legacy status-center and pending-preview keys to v2", () => {
    const now = Date.now();
    window.localStorage.setItem(
      LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "22222222-2222-2222-2222-222222222222",
          statusToken: "legacy-token",
          sourceUrl: "https://legacy.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "pending",
          createdAt: now - 10_000,
          updatedAt: now - 9_000,
          errorStage: "fetching_page",
        },
      ]),
    );
    window.localStorage.setItem(
      LEGACY_PENDING_PREVIEW_STORAGE_KEY,
      JSON.stringify({
        previewId: "22222222-2222-2222-2222-222222222222",
        statusToken: "pending-token",
        requestKey: "https://legacy.example.com|en|fr|hello@example.com",
        updatedAt: now,
      }),
    );

    hydratePreviewStatusCenterStore();

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0].statusToken).toBe("pending-token");
    expect(snapshot.jobs[0].requestKey).toBe(
      buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://legacy.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "hello@example.com",
      }),
    );
    expect(snapshot.jobs[0].status).toBe("processing");

    expect(window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_PENDING_PREVIEW_STORAGE_KEY)).toBeNull();
  });

  it("selects the latest job for a request key", () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
    });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));
      upsertPreviewStatusCenterJob(
        buildJob({
          previewId: "33333333-3333-3333-3333-333333333333",
          requestKey,
          statusToken: "first-token",
        }),
      );
      vi.setSystemTime(new Date("2026-02-20T12:00:01.000Z"));
      upsertPreviewStatusCenterJob(
        buildJob({
          previewId: "44444444-4444-4444-4444-444444444444",
          requestKey,
          statusToken: "second-token",
        }),
      );
    } finally {
      vi.useRealTimers();
    }

    const selected = selectLatestJobByRequestKey(requestKey);
    expect(selected?.previewId).toBe("44444444-4444-4444-4444-444444444444");
  });

  it("prefers active jobs over terminal jobs when selecting preferred job", () => {
    upsertPreviewStatusCenterJob(
      buildJob({
        previewId: "77777777-7777-7777-7777-777777777777",
        status: "ready",
      }),
    );
    upsertPreviewStatusCenterJob(
      buildJob({
        previewId: "88888888-8888-8888-8888-888888888888",
        status: "processing",
      }),
    );

    const selected = selectPreferredPreviewStatusCenterJob();
    expect(selected?.previewId).toBe("88888888-8888-8888-8888-888888888888");
  });

  it("treats provider-capacity waits as active when selecting preferred jobs", () => {
    upsertPreviewStatusCenterJob(
      buildJob({
        previewId: "77777777-7777-7777-7777-777777777777",
        status: "ready",
      }),
    );
    upsertPreviewStatusCenterJob(
      buildJob({
        previewId: "99999999-9999-9999-9999-999999999999",
        status: "waiting_provider_capacity",
        retryHint: {
          reason: "provider_capacity_wait",
          retryAfterSeconds: null,
          emailRecommended: true,
        },
      }),
    );

    const selected = selectPreferredPreviewStatusCenterJob();
    expect(selected?.previewId).toBe("99999999-9999-9999-9999-999999999999");
  });

  it("uses deterministic comparator for ties and malformed metadata", () => {
    const a: PreviewStatusCenterJob = {
      ...buildJob({
        previewId: "",
        requestKey: "",
        statusToken: "b",
      }),
      stage: null,
      previewUrl: null,
      error: null,
      errorCode: null,
      errorStage: null,
      retryHint: null,
      remoteStatusVerified: true,
      expiresAt: null,
      retryCount: 0,
      nextPollAt: Number.POSITIVE_INFINITY,
      updatedAt: Number.NaN,
      createdAt: Number.NaN,
    };
    const b: PreviewStatusCenterJob = {
      ...buildJob({
        previewId: "",
        requestKey: "",
        statusToken: "a",
      }),
      stage: null,
      previewUrl: null,
      error: null,
      errorCode: null,
      errorStage: null,
      retryHint: null,
      remoteStatusVerified: true,
      expiresAt: null,
      retryCount: 0,
      nextPollAt: Number.POSITIVE_INFINITY,
      updatedAt: Number.NaN,
      createdAt: Number.NaN,
    };

    expect(comparePreviewStatusCenterJobs(a, b)).toBe(0);
    expect(comparePreviewStatusCenterJobs(b, a)).toBe(0);
  });

  it("selects deterministically for mixed request keys with equal timestamps", () => {
    const requestKeyA = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://a.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    const requestKeyB = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://b.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-20T12:00:00.000Z"));
      upsertPreviewStatusCenterJob(
        buildJob({
          previewId: "aaaa0000-0000-0000-0000-000000000000",
          requestKey: requestKeyA,
          sourceUrl: "https://a.example.com",
        }),
      );
      upsertPreviewStatusCenterJob(
        buildJob({
          previewId: "bbbb0000-0000-0000-0000-000000000000",
          requestKey: requestKeyB,
          sourceUrl: "https://b.example.com",
        }),
      );
    } finally {
      vi.useRealTimers();
    }

    expect(selectLatestJobByRequestKey(requestKeyA)?.sourceUrl).toBe("https://a.example.com");
    expect(selectLatestJobByRequestKey(requestKeyB)?.sourceUrl).toBe("https://b.example.com");
  });

  it("uses persisted order as stable tie-breaker across selectors when primary fields collide", () => {
    const now = Date.now();
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://stable.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...buildJob({
            previewId: "",
            requestKey,
            statusToken: "first-token",
            sourceUrl: "https://first.example.com",
          }),
          createdAt: now,
          updatedAt: now,
        },
        {
          ...buildJob({
            previewId: "",
            requestKey,
            statusToken: "second-token",
            sourceUrl: "https://second.example.com",
          }),
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );

    hydratePreviewStatusCenterStore();
    expect(selectPreferredPreviewStatusCenterJob()?.statusToken).toBe("first-token");
    expect(selectLatestActivePreviewStatusCenterJob()?.statusToken).toBe("first-token");
    expect(selectLatestJobByRequestKey(requestKey)?.statusToken).toBe("first-token");
  });

  it("selects the pinned active job beyond the auto-restore age cutoff", () => {
    const now = Date.now();
    const jobs: PreviewStatusCenterJob[] = [
      {
        ...buildJob({
          previewId: "fresh-1111-1111-1111-111111111111",
          sourceUrl: "https://fresh.example.com",
        }),
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        remoteStatusVerified: false,
        createdAt: now - 1_000,
        updatedAt: now - 500,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: now + 5_000,
      },
      {
        ...buildJob({
          previewId: "stale-2222-2222-2222-222222222222",
          sourceUrl: "https://stale.example.com",
        }),
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        remoteStatusVerified: false,
        createdAt: now - RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS - 1,
        updatedAt: now - 250,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: now + 5_000,
      },
    ];

    expect(
      selectRestorablePreviewStatusCenterJob({
        jobs,
        pinnedPreviewId: "stale-2222-2222-2222-222222222222",
        now,
      })?.sourceUrl,
    ).toBe("https://stale.example.com");
  });

  it("falls back to a restorable terminal request-key match when a stale active job is newer", () => {
    const now = Date.now();
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://same.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    const jobs: PreviewStatusCenterJob[] = [
      {
        ...buildJob({
          previewId: "ready-3333-3333-3333-333333333333",
          requestKey,
          sourceUrl: "https://same.example.com",
          status: "ready",
        }),
        stage: null,
        previewUrl: "https://preview.example.com/ready",
        error: null,
        errorCode: null,
        errorStage: null,
        remoteStatusVerified: true,
        createdAt: now - RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS - 10_000,
        updatedAt: now - 2_000,
        expiresAt: now + 60_000,
        retryCount: 0,
        nextPollAt: Number.POSITIVE_INFINITY,
      },
      {
        ...buildJob({
          previewId: "stale-4444-4444-4444-444444444444",
          requestKey,
          sourceUrl: "https://same.example.com",
        }),
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        remoteStatusVerified: false,
        createdAt: now - RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS - 1,
        updatedAt: now,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: now + 5_000,
      },
    ];

    expect(
      selectRestorablePreviewStatusCenterJob({
        jobs,
        currentRequestKey: requestKey,
        now,
      })?.previewId,
    ).toBe("ready-3333-3333-3333-333333333333");
  });

  it("does not restore old active jobs as the primary try-form job", () => {
    const now = Date.now();
    const stale: PreviewStatusCenterJob = {
      ...buildJob({
        previewId: "stale-3333-3333-3333-333333333333",
        sourceUrl: "https://stale.example.com",
      }),
      stage: null,
      previewUrl: null,
      error: null,
      errorCode: null,
      errorStage: null,
      remoteStatusVerified: false,
      createdAt: now - RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS - 1,
      updatedAt: now,
      expiresAt: null,
      retryCount: 0,
      nextPollAt: now + 5_000,
    };

    expect(
      selectRestorablePreviewStatusCenterJob({
        jobs: [stale],
        now,
      }),
    ).toBeNull();
  });

  it("drops unknown phases from storage and warns once per hydration pass", () => {
    const now = Date.now();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...buildJob({
            previewId: "99999999-9999-9999-9999-999999999999",
            status: "processing",
          }),
          createdAt: now - 1_000,
          updatedAt: now - 500,
        },
        {
          ...buildJob({
            previewId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          }),
          status: "queued",
          createdAt: now - 2_000,
          updatedAt: now - 1_500,
        },
      ]),
    );

    hydratePreviewStatusCenterStore();
    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0].status).toBe("processing");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("Dropped preview jobs with unknown phase");
  });

  it("round-trips v2 request keys when URL and email contain pipes", () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com/a|b?mode=test",
      sourceLang: "EN",
      targetLang: "fr",
      email: "hello|team@example.com",
    });
    const parsed = parsePreviewStatusCenterRequestKey(requestKey);

    expect(parsed).toEqual({
      sourceUrl: "https://example.com/a|b?mode=test",
      sourceLang: "en",
      targetLang: "fr",
      email: "hello|team@example.com",
    });
  });

  it("keeps parsing legacy delimiter request keys", () => {
    const parsed = parsePreviewStatusCenterRequestKey(
      "https://legacy.example.com|en|fr|old@example.com",
    );

    expect(parsed).toEqual({
      sourceUrl: "https://legacy.example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "old@example.com",
    });
  });
});
