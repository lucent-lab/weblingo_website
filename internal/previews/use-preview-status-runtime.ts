"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  calculatePreviewStatusCenterRetryDelayMs,
  cleanupPreviewStatusCenterJobs,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  hydratePreviewStatusCenterStore,
  isPreviewStatusCenterJobActive,
  markPreviewStatusCenterJobTerminal,
  PREVIEW_ACTIVE_JOB_MAX_AGE_MS,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  rehydratePreviewStatusCenterStoreFromStorage,
  resetPreviewStatusCenterJobRetry,
  subscribePreviewStatusCenterStore,
  updatePreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "./status-center-store";
import { resolvePreviewStatusDecision } from "./preview-status-decision";
import { resolvePreviewRetryHintDelayMs } from "./preview-job-machine";
import { buildPreviewJobStatusUrl } from "./preview-job-policy";

const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;
let previewStatusRuntimeOwner: symbol | null = null;

type PreviewStatusCenterJobWithExpiry = PreviewStatusCenterJob & { expiresAt: number };

function hasTerminalExpiry(job: PreviewStatusCenterJob): job is PreviewStatusCenterJobWithExpiry {
  return (job.status === "ready" || job.status === "failed") && job.expiresAt !== null;
}

// A poll that started with a token another tab has since rotated must not have
// its auth-shaped rejection treated as the job's verdict; the next tick polls
// with the fresh token instead.
function hasRotatedStatusToken(job: PreviewStatusCenterJob): boolean {
  const current = getPreviewStatusCenterJobsSnapshot().find(
    (candidate) => candidate.previewId === job.previewId,
  );
  return current !== undefined && current.statusToken !== job.statusToken;
}

export function resetPreviewStatusRuntimeOwnerForTests() {
  previewStatusRuntimeOwner = null;
}

export function usePreviewStatusRuntime() {
  const jobs = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterJobsSnapshot,
    getPreviewStatusCenterServerJobsSnapshot,
  );
  const ownerIdRef = useRef(Symbol("preview-status-runtime-owner"));
  const isOwnerRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    const ownerId = ownerIdRef.current;

    if (previewStatusRuntimeOwner === null || previewStatusRuntimeOwner === ownerId) {
      previewStatusRuntimeOwner = ownerId;
      isOwnerRef.current = true;
      return () => {
        if (previewStatusRuntimeOwner === ownerId) {
          previewStatusRuntimeOwner = null;
        }
        isOwnerRef.current = false;
      };
    }

    isOwnerRef.current = false;
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Preview status runtime mounted without ownership",
      }),
    );
    return () => {
      isOwnerRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOwnerRef.current) {
      return;
    }
    hydratePreviewStatusCenterStore();
    cleanupPreviewStatusCenterJobs();
  }, []);

  useEffect(() => {
    if (!isOwnerRef.current) {
      return;
    }
    // Cross-tab convergence: another tab committing the shared snapshot (for
    // example rotating a status token on a duplicate submission) must replace
    // this tab's stale in-memory job before its next poll 401s into a false
    // terminal failure. `storage` events only fire in non-writing tabs, so
    // this never loops.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== PREVIEW_STATUS_CENTER_STORAGE_KEY) {
        return;
      }
      rehydratePreviewStatusCenterStoreFromStorage({ preservePinnedActiveLocalJob: true });
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isOwnerRef.current) {
      return;
    }

    let nextExpiryAt: number | null = null;
    const schedulingNow = Date.now();
    for (const job of jobs) {
      if (hasTerminalExpiry(job)) {
        nextExpiryAt =
          nextExpiryAt === null ? job.expiresAt : Math.min(nextExpiryAt, job.expiresAt);
      }
      if (isPreviewStatusCenterJobActive(job)) {
        const staleAt = job.createdAt + PREVIEW_ACTIVE_JOB_MAX_AGE_MS;
        // Already-over-budget jobs resolve through /status polling (server truth
        // first) and, failing that, through the prune pass each failed poll
        // commits; scheduling a past-due cleanup here would only busy-loop.
        if (staleAt > schedulingNow) {
          nextExpiryAt = nextExpiryAt === null ? staleAt : Math.min(nextExpiryAt, staleAt);
        }
      }
    }
    if (nextExpiryAt === null) {
      return;
    }

    const delayMs = Math.max(0, Math.min(nextExpiryAt - Date.now(), MAX_TIMEOUT_DELAY_MS));
    const timeout = window.setTimeout(() => {
      cleanupPreviewStatusCenterJobs();
    }, delayMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [jobs]);

  useEffect(() => {
    if (!isOwnerRef.current) {
      return;
    }

    const hasActiveJobs = jobs.some((job) => isPreviewStatusCenterJobActive(job));
    if (!hasActiveJobs) {
      return;
    }

    const pollJob = async (job: PreviewStatusCenterJob) => {
      try {
        const response = await fetch(buildPreviewJobStatusUrl(job.previewId, job.statusToken), {
          cache: "no-store",
        });

        const bodyText = await response.text();
        let payload: Record<string, unknown> | null = null;
        if (bodyText) {
          try {
            payload = JSON.parse(bodyText) as Record<string, unknown>;
          } catch {
            payload = null;
          }
        }

        const decision = resolvePreviewStatusDecision({
          responseOk: response.ok,
          responseStatus: response.status,
          payload,
          defaultErrorMessage: "Unable to check preview status.",
          mapNotFoundToErrorCode: true,
        });
        if (decision.kind === "terminal") {
          if (!response.ok) {
            rehydratePreviewStatusCenterStoreFromStorage({ preserveLocalJobs: true });
            if (hasRotatedStatusToken(job)) {
              return;
            }
          }
          markPreviewStatusCenterJobTerminal(job.previewId, decision.status, {
            previewUrl: decision.previewUrl,
            demoDashboardUrl: decision.demoDashboardUrl,
            expiresAt: decision.expiresAt,
            error: decision.error,
            errorCode: decision.errorCode,
            errorStage: decision.errorStage,
          });
          return;
        }

        // Transport/transient failures never fabricate a terminal state: keep the job
        // active with capped backoff until the server answers or the wall-clock budget
        // stale-fails it during store pruning.
        const retryCount = decision.remoteStatusVerified ? 0 : job.retryCount + 1;
        const nextStatus = decision.remoteStatusVerified ? decision.status : job.status;
        const nextStage = decision.remoteStatusVerified ? decision.stage : job.stage;
        const nextRetryHint = decision.remoteStatusVerified ? decision.retryHint : job.retryHint;
        const retryHintDelayMs = resolvePreviewRetryHintDelayMs(nextRetryHint);
        updatePreviewStatusCenterJob(job.previewId, {
          status: nextStatus,
          stage: nextStage ?? undefined,
          previewUrl: decision.previewUrl,
          expiresAt: decision.expiresAt,
          error: null,
          errorCode: null,
          errorStage: null,
          retryHint: nextRetryHint,
          remoteStatusVerified: decision.remoteStatusVerified,
          retryCount,
          nextPollAt: decision.remoteStatusVerified
            ? retryHintDelayMs === null
              ? undefined
              : Date.now() + retryHintDelayMs
            : Date.now() +
              Math.max(calculatePreviewStatusCenterRetryDelayMs(retryCount), retryHintDelayMs ?? 0),
        });
        if (decision.remoteStatusVerified) {
          if (retryHintDelayMs === null) {
            resetPreviewStatusCenterJobRetry(job.previewId);
          }
        }
      } catch {
        const retryCount = job.retryCount + 1;
        const retryHintDelayMs = resolvePreviewRetryHintDelayMs(job.retryHint);
        const retryDelayMs = Math.max(
          calculatePreviewStatusCenterRetryDelayMs(retryCount),
          retryHintDelayMs ?? 0,
        );
        updatePreviewStatusCenterJob(job.previewId, {
          remoteStatusVerified: false,
          retryCount,
          nextPollAt: Date.now() + retryDelayMs,
        });
      }
    };

    const tick = async () => {
      const now = Date.now();
      const dueJobs = jobs.filter(
        (job) => isPreviewStatusCenterJobActive(job) && now >= job.nextPollAt,
      );

      await Promise.all(
        dueJobs.map(async (job) => {
          if (inFlightRef.current.has(job.previewId)) {
            return;
          }
          inFlightRef.current.add(job.previewId);
          try {
            await pollJob(job);
          } finally {
            inFlightRef.current.delete(job.previewId);
          }
        }),
      );
    };

    void tick();
    const nextDueAt = Math.min(
      ...jobs
        .filter((job) => isPreviewStatusCenterJobActive(job))
        .map((job) => job.nextPollAt)
        .filter((nextPollAt) => Number.isFinite(nextPollAt)),
    );
    const nextDueDelayMs = nextDueAt - Date.now();
    const nextDueTimeout =
      nextDueDelayMs > 0 && nextDueDelayMs < DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS
        ? window.setTimeout(() => {
            void tick();
          }, nextDueDelayMs)
        : null;
    const interval = window.setInterval(() => {
      void tick();
    }, DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS);

    return () => {
      if (nextDueTimeout !== null) {
        window.clearTimeout(nextDueTimeout);
      }
      window.clearInterval(interval);
    };
  }, [jobs]);
}
