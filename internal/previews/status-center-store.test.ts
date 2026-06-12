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
  PREVIEW_ACTIVE_JOB_MAX_AGE_MS,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  rehydratePreviewStatusCenterStoreFromStorage,
  removePreviewStatusCenterJob,
  resetPreviewStatusCenterJobRetry,
  resetPreviewStatusCenterStoreForTests,
  RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS,
  selectPreferredPreviewStatusCenterJob,
  selectCurrentActivePreviewStatusCenterJob,
  selectLatestActivePreviewStatusCenterJob,
  selectLatestJobByRequestKey,
  selectRestorablePreviewStatusCenterJob,
  setPreviewStatusCenterJobRetry,
  updatePreviewStatusCenterJob,
  upsertPreviewStatusCenterJob,
  writeActivePreviewIdToSession,
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
  window.sessionStorage.clear();
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

  it("adopts a rotated status token committed by another tab during rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));
    const local = getPreviewStatusCenterJobsSnapshot()[0];

    // Another tab resubmitted the same preview: the create endpoint rotated the
    // status token and that tab committed the newer snapshot to localStorage.
    const stored = JSON.parse(
      window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)!,
    ) as Array<Record<string, unknown>>;
    stored[0].statusToken = "rotated-token";
    stored[0].updatedAt = local.updatedAt + 1;
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(stored));

    rehydratePreviewStatusCenterStoreFromStorage();

    const jobs = getPreviewStatusCenterJobsSnapshot();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].statusToken).toBe("rotated-token");
    expect(jobs[0].status).toBe("processing");
  });

  it("adopts a rotated token even when local progress is newer than the rotating tab's row", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));
    const local = getPreviewStatusCenterJobsSnapshot()[0];

    // Another tab reattached (rotating the token), then this tab applied a
    // later SSE/poll progress update: the local row is newer overall, but the
    // token stamp proves the rotation happened after the local token was set.
    const stored = JSON.parse(
      window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)!,
    ) as Array<Record<string, unknown>>;
    stored[0].statusToken = "rotated-token";
    stored[0].statusTokenUpdatedAt = local.statusTokenUpdatedAt + 5;
    stored[0].updatedAt = local.updatedAt - 1;
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(stored));

    rehydratePreviewStatusCenterStoreFromStorage();

    const merged = getPreviewStatusCenterJobsSnapshot()[0];
    expect(merged.statusToken).toBe("rotated-token");
    expect(merged.statusTokenUpdatedAt).toBe(local.statusTokenUpdatedAt + 5);
    // The newer local row still wins everything except the token.
    expect(merged.updatedAt).toBe(local.updatedAt);
    expect(merged.status).toBe("processing");
  });

  it("keeps a locally rotated token when another tab commits stale-token progress", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));
    const before = getPreviewStatusCenterJobsSnapshot()[0];
    updatePreviewStatusCenterJob(before.previewId, { statusToken: "locally-rotated" });
    const local = getPreviewStatusCenterJobsSnapshot()[0];

    // The other tab never saw the rotation and committed newer progress
    // carrying the revoked token.
    const stored = JSON.parse(
      window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)!,
    ) as Array<Record<string, unknown>>;
    stored[0].statusToken = "status-token";
    stored[0].statusTokenUpdatedAt = local.statusTokenUpdatedAt - 5;
    stored[0].updatedAt = local.updatedAt + 10;
    stored[0].stage = "translating";
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(stored));

    rehydratePreviewStatusCenterStoreFromStorage();

    const merged = getPreviewStatusCenterJobsSnapshot()[0];
    expect(merged.statusToken).toBe("locally-rotated");
    expect(merged.statusTokenUpdatedAt).toBe(local.statusTokenUpdatedAt);
    // The newer incoming row wins everything except the token.
    expect(merged.stage).toBe("translating");
  });

  it("keeps the newer local job over a stale persisted snapshot during rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));
    const local = getPreviewStatusCenterJobsSnapshot()[0];

    const stored = JSON.parse(
      window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)!,
    ) as Array<Record<string, unknown>>;
    stored[0].statusToken = "older-token";
    stored[0].statusTokenUpdatedAt = local.statusTokenUpdatedAt - 1;
    stored[0].updatedAt = local.updatedAt - 1;
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(stored));

    rehydratePreviewStatusCenterStoreFromStorage();

    expect(getPreviewStatusCenterJobsSnapshot()[0].statusToken).toBe("status-token");
  });

  it("drops jobs removed by another tab during rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));

    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify([]));

    rehydratePreviewStatusCenterStoreFromStorage();

    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(0);
  });

  it("preserves local-only jobs during an explicit pre-poll rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));

    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify([]));

    rehydratePreviewStatusCenterStoreFromStorage({ preserveLocalJobs: true });

    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(1);
    expect(getPreviewStatusCenterJobsSnapshot()[0].previewId).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("preserves a session-pinned active local-only job during storage-event rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));
    writeActivePreviewIdToSession("11111111-1111-1111-1111-111111111111");

    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify([]));

    rehydratePreviewStatusCenterStoreFromStorage({ preservePinnedActiveLocalJob: true });

    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(1);
    expect(getPreviewStatusCenterJobsSnapshot()[0]).toMatchObject({
      previewId: "11111111-1111-1111-1111-111111111111",
      status: "processing",
    });
  });

  it("still drops unpinned local-only jobs during storage-event rehydration", () => {
    upsertPreviewStatusCenterJob(buildJob({ status: "processing" }));

    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify([]));

    rehydratePreviewStatusCenterStoreFromStorage({ preservePinnedActiveLocalJob: true });

    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(0);
  });

  it("clears hydrated preview links with unresolved route placeholders", () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "",
    });
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "11111111-1111-1111-1111-111111111111",
          requestKey,
          statusToken: "status-token",
          sourceUrl: "https://example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "ready",
          previewUrl: "https://t2.weblingo.app/demo/%7Blang%7D",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=%7Blang%7D",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]),
    );

    hydratePreviewStatusCenterStore();

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0]).toMatchObject({
      status: "ready",
      previewUrl: null,
      demoDashboardUrl: null,
    });
  });

  it("derives active polling from retry hints when no explicit poll time exists", () => {
    const now = Date.now();
    upsertPreviewStatusCenterJob(
      buildJob({
        status: "waiting_provider_capacity",
        retryHint: {
          reason: "provider_capacity_wait",
          retryAfterSeconds: 30,
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

  it("expires ready prospect showcase jobs with stale expiry and preserves dashboard handoffs", () => {
    upsertPreviewStatusCenterJob(
      buildJob({
        previewId: "expired-ready-1111-1111-1111-111111111111",
        status: "ready",
        previewUrl: "https://showcase.example.com/fr",
        demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=old",
        expiresAt: Date.now() - 1_000,
      }),
    );

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0]).toMatchObject({
      status: "expired",
      previewUrl: null,
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=old",
      errorCode: "preview_expired",
    });
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

  it("clears legacy preview storage keys without migrating old preview jobs", () => {
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
        updatedAt: Date.now(),
      }),
    );

    hydratePreviewStatusCenterStore();

    const snapshot = getPreviewStatusCenterSnapshot();
    expect(snapshot.jobs).toHaveLength(0);

    expect(window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY)).toBeNull();
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
      lastVerifiedAt: null,
      statusTokenUpdatedAt: 0,
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
      lastVerifiedAt: null,
      statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: null,
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: null,
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: null,
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: null,
        statusTokenUpdatedAt: 0,
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
      lastVerifiedAt: null,
      statusTokenUpdatedAt: 0,
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

  it("rejects legacy delimiter request keys", () => {
    const parsed = parsePreviewStatusCenterRequestKey(
      "https://legacy.example.com|en|fr|old@example.com",
    );

    expect(parsed).toBeNull();
  });

  it("rejects old preview v2 request keys and stored jobs", () => {
    const now = Date.now();
    const previewRequestKey = "v2:preview|https%3A%2F%2Fexample.com|en|fr|";
    const prospectRequestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(parsePreviewStatusCenterRequestKey(previewRequestKey)).toBeNull();
    expect(parsePreviewStatusCenterRequestKey(prospectRequestKey)).toMatchObject({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
    });

    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...buildJob({
            previewId: "preview-1111-1111-1111-111111111111",
            requestKey: previewRequestKey,
            statusToken: "preview-token",
          }),
          kind: "preview",
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
        },
        {
          ...buildJob({
            previewId: "prospect-1111-1111-1111-111111111111",
            requestKey: prospectRequestKey,
            statusToken: "prospect-token",
          }),
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
        },
      ]),
    );

    hydratePreviewStatusCenterStore();

    expect(selectLatestJobByRequestKey(previewRequestKey)).toBeNull();
    expect(selectLatestJobByRequestKey(prospectRequestKey)?.previewId).toBe(
      "prospect-1111-1111-1111-111111111111",
    );
    expect(
      selectRestorablePreviewStatusCenterJob({ currentRequestKey: prospectRequestKey })?.previewId,
    ).toBe("prospect-1111-1111-1111-111111111111");
  });

  it("keeps over-budget active jobs alive until repeated verification attempts fail", () => {
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...buildJob({
            previewId: "budget-1111-1111-1111-111111111111",
            status: "processing",
          }),
          stage: "translating",
          createdAt: now - PREVIEW_ACTIVE_JOB_MAX_AGE_MS - 1,
          updatedAt: now - 1_000,
          retryCount: 5,
          nextPollAt: now + 60_000,
        },
      ]),
    );

    hydratePreviewStatusCenterStore();

    // Server truth first: hydration never fabricates a failure (even with a
    // persisted retry count) and schedules an immediate verification poll.
    const restored = getPreviewStatusCenterJobsSnapshot()[0];
    expect(restored).toMatchObject({
      status: "processing",
      retryCount: 0,
      remoteStatusVerified: false,
    });
    expect(restored!.nextPollAt).toBeLessThanOrEqual(Date.now());

    // Two failed verification attempts are still not enough.
    updatePreviewStatusCenterJob("budget-1111-1111-1111-111111111111", {
      remoteStatusVerified: false,
      retryCount: 2,
      nextPollAt: Date.now() + 10_000,
    });
    expect(getPreviewStatusCenterJobsSnapshot()[0]?.status).toBe("processing");

    // The third consecutive failure trips the unreachable-server backstop.
    updatePreviewStatusCenterJob("budget-1111-1111-1111-111111111111", {
      remoteStatusVerified: false,
      retryCount: 3,
      nextPollAt: Date.now() + 20_000,
    });
    expect(getPreviewStatusCenterJobsSnapshot()[0]).toMatchObject({
      status: "failed",
      errorCode: "processing_stalled",
      errorStage: "translating",
      remoteStatusVerified: true,
      nextPollAt: Number.POSITIVE_INFINITY,
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY) ?? "[]",
    ) as Array<{ previewId: string; status: string }>;
    expect(persisted[0]?.status).toBe("failed");
  });

  it("drops ancient active jobs past the storage TTL instead of resurrecting them as failures", () => {
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...buildJob({
            previewId: "ancient-1111-1111-1111-111111111111",
            status: "processing",
          }),
          createdAt: now - 3 * 24 * 60 * 60 * 1000,
          updatedAt: now - 2 * 24 * 60 * 60 * 1000,
        },
      ]),
    );

    hydratePreviewStatusCenterStore();

    // Stale-failing rewrites updatedAt to now; the TTL drop must happen on the
    // stored timestamp so a days-old entry never reappears as a fresh failure.
    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(0);
  });

  it("selects only the single current active job for the status center", () => {
    const pinned = buildJob({
      previewId: "pinned-1111-1111-1111-111111111111",
      status: "processing",
    });
    const other = buildJob({
      previewId: "other-2222-2222-2222-222222222222",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://other.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "",
      }),
      sourceUrl: "https://other.example.com",
      status: "pending",
    });
    const terminal = buildJob({
      previewId: "done-3333-3333-3333-333333333333",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://done.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "",
      }),
      sourceUrl: "https://done.example.com",
      status: "ready" as const,
    });
    upsertPreviewStatusCenterJob(pinned);
    upsertPreviewStatusCenterJob(other);
    upsertPreviewStatusCenterJob(terminal);
    const jobs = getPreviewStatusCenterJobsSnapshot();

    expect(
      selectCurrentActivePreviewStatusCenterJob({
        jobs,
        pinnedPreviewId: "pinned-1111-1111-1111-111111111111",
      })?.previewId,
    ).toBe("pinned-1111-1111-1111-111111111111");

    expect(
      selectCurrentActivePreviewStatusCenterJob({
        jobs,
        pinnedPreviewId: "done-3333-3333-3333-333333333333",
      }),
    ).toBeNull();

    expect(
      selectCurrentActivePreviewStatusCenterJob({
        jobs: [getPreviewStatusCenterJobsSnapshot().find((job) => job.status === "ready")!],
        pinnedPreviewId: null,
      }),
    ).toBeNull();
  });
});
