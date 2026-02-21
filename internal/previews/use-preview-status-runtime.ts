"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  hasExplicitFailure,
  isPreviewErrorCode,
  isPreviewStage,
  resolveStatusCheckFailure,
  type PreviewErrorCode,
  type PreviewStage,
} from "./preview-sse";
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

const MAX_STATUS_RETRY_ATTEMPTS = 4;
let previewStatusRuntimeOwner: symbol | null = null;

export function resetPreviewStatusRuntimeOwnerForTests() {
  previewStatusRuntimeOwner = null;
}

function resolveErrorPayload(
  payload: Record<string, unknown> | null,
): {
  code: PreviewErrorCode | null;
  stage: PreviewStage | null;
  message: string;
} {
  const details =
    payload && typeof payload.details === "object" && payload.details !== null
      ? (payload.details as Record<string, unknown>)
      : null;

  const code = isPreviewErrorCode(payload?.errorCode)
    ? payload.errorCode
    : details && isPreviewErrorCode(details.errorCode)
      ? details.errorCode
      : null;

  const stage = isPreviewStage(payload?.errorStage)
    ? payload.errorStage
    : details && isPreviewStage(details.errorStage)
      ? details.errorStage
      : null;

  const message =
    (payload?.error as string | undefined) ||
    (payload?.message as string | undefined) ||
    "Unable to check preview status.";

  return {
    code,
    stage,
    message,
  };
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
    if (previewStatusRuntimeOwner === null || previewStatusRuntimeOwner === ownerIdRef.current) {
      previewStatusRuntimeOwner = ownerIdRef.current;
      isOwnerRef.current = true;
      return () => {
        if (previewStatusRuntimeOwner === ownerIdRef.current) {
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

        if (!response.ok) {
          if (response.status === 410) {
            markPreviewStatusCenterJobTerminal(job.previewId, "expired", {
              errorCode: "preview_expired",
              error: null,
              errorStage: null,
            });
            return;
          }

          if (response.status === 404) {
            markPreviewStatusCenterJobTerminal(job.previewId, "failed", {
              errorCode: "preview_not_found",
              error: null,
              errorStage: null,
            });
            return;
          }

          const decision = resolveStatusCheckFailure(response.status, payload);
          if (decision === "processing") {
            updatePreviewStatusCenterJob(job.previewId, {
              status: "processing",
              error: null,
              errorCode: null,
              errorStage: null,
            });
            resetPreviewStatusCenterJobRetry(job.previewId);
            return;
          }

          const resolved = resolveErrorPayload(payload);
          markPreviewStatusCenterJobTerminal(
            job.previewId,
            resolved.code === "preview_expired" ? "expired" : "failed",
            {
              error: resolved.message,
              errorCode: resolved.code,
              errorStage: resolved.stage,
            },
          );
          return;
        }

        if (!payload) {
          updatePreviewStatusCenterJob(job.previewId, {
            status: "processing",
            error: null,
            errorCode: null,
            errorStage: null,
          });
          resetPreviewStatusCenterJobRetry(job.previewId);
          return;
        }

        if (payload.status === "ready") {
          markPreviewStatusCenterJobTerminal(job.previewId, "ready", {
            previewUrl: typeof payload.previewUrl === "string" ? payload.previewUrl : null,
            error: null,
            errorCode: null,
            errorStage: null,
          });
          return;
        }

        if (payload.status === "failed" || hasExplicitFailure(payload)) {
          const resolved = resolveErrorPayload(payload);
          markPreviewStatusCenterJobTerminal(
            job.previewId,
            resolved.code === "preview_expired" ? "expired" : "failed",
            {
              error: resolved.message,
              errorCode: resolved.code,
              errorStage: resolved.stage,
            },
          );
          return;
        }

        updatePreviewStatusCenterJob(job.previewId, {
          status: payload.status === "pending" ? "pending" : "processing",
          stage: isPreviewStage(payload.stage) ? payload.stage : undefined,
          previewUrl: typeof payload.previewUrl === "string" ? payload.previewUrl : undefined,
          error: null,
          errorCode: null,
          errorStage: null,
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
      const dueJobs = jobs.filter((job) => isPreviewStatusCenterJobActive(job) && now >= job.nextPollAt);

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
