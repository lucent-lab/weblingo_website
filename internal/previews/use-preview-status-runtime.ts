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
  setPreviewStatusCenterJobRetry,
  subscribePreviewStatusCenterStore,
  updatePreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "./status-center-store";
import { resolvePreviewStatusDecision } from "./preview-status-decision";

const MAX_STATUS_RETRY_ATTEMPTS = 4;
let previewStatusRuntimeOwner: symbol | null = null;

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

    const hasActiveJobs = jobs.some((job) => isPreviewStatusCenterJobActive(job));
    if (!hasActiveJobs) {
      return;
    }

    const pollJob = async (job: PreviewStatusCenterJob) => {
      try {
        const response = await fetch(
          `/api/previews/${job.previewId}?token=${encodeURIComponent(job.statusToken)}`,
          {
            cache: "no-store",
          },
        );

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
            error: decision.error,
            errorCode: decision.errorCode,
            errorStage: decision.errorStage,
          });
          return;
        }

        updatePreviewStatusCenterJob(job.previewId, {
          status: decision.status,
          stage: decision.stage ?? undefined,
          previewUrl: decision.previewUrl,
          error: null,
          errorCode: null,
          errorStage: null,
          retryHint: decision.retryHint,
        });
        resetPreviewStatusCenterJobRetry(job.previewId);
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

        setPreviewStatusCenterJobRetry(
          job.previewId,
          retryCount,
          calculatePreviewStatusCenterRetryDelayMs(retryCount),
        );
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
    const interval = window.setInterval(() => {
      void tick();
    }, DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [jobs]);
}
