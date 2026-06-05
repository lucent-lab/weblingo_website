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
  resetPreviewStatusCenterJobRetry,
  subscribePreviewStatusCenterStore,
  updatePreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "./status-center-store";
import { resolvePreviewStatusDecision } from "./preview-status-decision";
import { resolvePreviewRetryHintDelayMs } from "./preview-job-machine";
import { buildPreviewJobStatusUrl } from "./preview-job-policy";

const MAX_STATUS_RETRY_ATTEMPTS = 4;
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;
let previewStatusRuntimeOwner: symbol | null = null;

type PreviewStatusCenterJobWithExpiry = PreviewStatusCenterJob & { expiresAt: number };

function hasTerminalExpiry(job: PreviewStatusCenterJob): job is PreviewStatusCenterJobWithExpiry {
  return (job.status === "ready" || job.status === "failed") && job.expiresAt !== null;
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

    let nextExpiryAt: number | null = null;
    for (const job of jobs) {
      if (!hasTerminalExpiry(job)) {
        continue;
      }
      nextExpiryAt = nextExpiryAt === null ? job.expiresAt : Math.min(nextExpiryAt, job.expiresAt);
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

        const retryCount = decision.remoteStatusVerified ? 0 : job.retryCount + 1;
        if (!decision.remoteStatusVerified && retryCount > MAX_STATUS_RETRY_ATTEMPTS) {
          markPreviewStatusCenterJobTerminal(job.previewId, "failed", {
            errorCode: "unknown",
            error: "Unable to check preview status.",
            errorStage: null,
          });
          return;
        }

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
        if (retryCount > MAX_STATUS_RETRY_ATTEMPTS) {
          markPreviewStatusCenterJobTerminal(job.previewId, "failed", {
            errorCode: "unknown",
            error: "Unable to check preview status.",
            errorStage: null,
          });
          return;
        }

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
