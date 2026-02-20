"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createClientTranslator, type ClientMessages } from "@internal/i18n";
import {
  hasExplicitFailure,
  isPreviewErrorCode,
  isPreviewStage,
  resolveStatusCheckFailure,
  type PreviewErrorCode,
  type PreviewStage,
} from "@internal/previews/preview-sse";
import {
  calculatePreviewStatusCenterRetryDelayMs,
  cleanupPreviewStatusCenterJobs,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterServerSnapshot,
  getPreviewStatusCenterSnapshot,
  hydratePreviewStatusCenterStore,
  isPreviewStatusCenterJobActive,
  isPreviewStatusCenterJobTerminal,
  markPreviewStatusCenterJobTerminal,
  removePreviewStatusCenterJob,
  resetPreviewStatusCenterJobRetry,
  setPreviewStatusCenterJobRetry,
  subscribePreviewStatusCenterStore,
  updatePreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "@internal/previews/status-center-store";

const PREVIEW_ERROR_MESSAGE_KEYS: Record<PreviewErrorCode, string> = {
  invalid_url: "try.error.invalid_url",
  blocked_host: "try.error.blocked_host",
  dns_failed: "try.error.dns_failed",
  dns_timeout: "try.error.dns_timeout",
  page_too_large: "try.error.page_too_large",
  render_failed: "try.error.render_failed",
  template_decode_failed: "try.error.template_decode_failed",
  waf_blocked: "try.error.waf_blocked",
  translate_failed: "try.error.translate_failed",
  storage_failed: "try.error.storage_failed",
  config_error: "try.error.config_error",
  processing_timeout: "try.error.processing_timeout",
  queue_enqueue_failed: "try.error.queue_enqueue_failed",
  preview_not_found: "try.error.preview_not_found",
  preview_expired: "try.error.preview_expired",
  canceled: "try.error.canceled",
  unknown: "try.error.unknown",
};

const PREVIEW_STAGE_MESSAGE_KEYS: Record<PreviewStage, string> = {
  fetching_page: "try.stage.fetching_page",
  analyzing_content: "try.stage.analyzing_content",
  translating: "try.stage.translating",
  generating_preview: "try.stage.generating_preview",
  saving: "try.stage.saving",
};

const MAX_STATUS_RETRY_ATTEMPTS = 4;

type PreviewStatusCenterProps = {
  messages: ClientMessages;
};

function resolveErrorPayload(
  payload: Record<string, unknown> | null,
  fallbackMessage: string,
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
    fallbackMessage;

  return { code, stage, message };
}

function resolveStageMessage(job: PreviewStatusCenterJob, t: ReturnType<typeof createClientTranslator>) {
  if (job.errorStage && isPreviewStage(job.errorStage)) {
    return t(PREVIEW_STAGE_MESSAGE_KEYS[job.errorStage]);
  }
  return null;
}

function resolveStatusMessage(job: PreviewStatusCenterJob, t: ReturnType<typeof createClientTranslator>) {
  if (job.status === "pending") {
    return resolveStageMessage(job, t) ?? t("try.status.pending");
  }
  if (job.status === "processing") {
    return resolveStageMessage(job, t) ?? t("try.status.processing");
  }
  if (job.status === "ready") {
    return t("try.status.ready");
  }
  if (job.status === "expired") {
    return t("try.error.preview_expired");
  }
  return job.error ?? t("try.error.default");
}

function resolveHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function resolveStatusClass(job: PreviewStatusCenterJob): string {
  if (job.status === "ready") {
    return "text-primary";
  }
  if (job.status === "failed" || job.status === "expired") {
    return "text-destructive";
  }
  return "text-foreground";
}

export function PreviewStatusCenter({ messages }: PreviewStatusCenterProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const inFlightRef = useRef(new Set<string>());
  const { jobs } = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterSnapshot,
    getPreviewStatusCenterServerSnapshot,
  );

  useEffect(() => {
    hydratePreviewStatusCenterStore();
    cleanupPreviewStatusCenterJobs();
  }, []);

  useEffect(() => {
    if (jobs.length === 0) {
      return;
    }

    const pollJob = async (job: PreviewStatusCenterJob) => {
      try {
        const response = await fetch(
          `/api/previews/${job.previewId}?token=${encodeURIComponent(job.statusToken)}`,
          { cache: "no-store" },
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
              error: t("try.error.preview_expired"),
              errorCode: "preview_expired",
            });
            return;
          }
          if (response.status === 404) {
            markPreviewStatusCenterJobTerminal(job.previewId, "failed", {
              error: t("try.error.preview_not_found"),
              errorCode: "preview_not_found",
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

          const resolved = resolveErrorPayload(payload, t("try.error.default"));
          const terminalStatus = resolved.code === "preview_expired" ? "expired" : "failed";
          markPreviewStatusCenterJobTerminal(job.previewId, terminalStatus, {
            error: resolved.code ? t(PREVIEW_ERROR_MESSAGE_KEYS[resolved.code]) : resolved.message,
            errorCode: resolved.code,
            errorStage: resolved.stage,
          });
          return;
        }

        if (!payload) {
          updatePreviewStatusCenterJob(job.previewId, {
            status: "processing",
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
          const resolved = resolveErrorPayload(payload, t("try.error.default"));
          const terminalStatus = resolved.code === "preview_expired" ? "expired" : "failed";
          markPreviewStatusCenterJobTerminal(job.previewId, terminalStatus, {
            error: resolved.code ? t(PREVIEW_ERROR_MESSAGE_KEYS[resolved.code]) : resolved.message,
            errorCode: resolved.code,
            errorStage: resolved.stage,
          });
          return;
        }

        const stage = isPreviewStage(payload.stage) ? payload.stage : null;
        updatePreviewStatusCenterJob(job.previewId, {
          status: payload.status === "pending" ? "pending" : "processing",
          previewUrl: typeof payload.previewUrl === "string" ? payload.previewUrl : job.previewUrl,
          error: null,
          errorCode: null,
          errorStage: stage,
        });
        resetPreviewStatusCenterJobRetry(job.previewId);
      } catch {
        const retryCount = job.retryCount + 1;
        if (retryCount > MAX_STATUS_RETRY_ATTEMPTS) {
          markPreviewStatusCenterJobTerminal(job.previewId, "failed", {
            error: t("try.error.checkStatusFailed"),
            errorCode: "unknown",
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
  }, [jobs, t]);

  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => b.updatedAt - a.updatedAt), [jobs]);

  if (sortedJobs.length === 0) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 left-2 right-2 z-50 max-w-sm space-y-2 sm:left-auto sm:right-4"
      aria-live="polite"
    >
      {sortedJobs.map((job) => {
        const terminal = isPreviewStatusCenterJobTerminal(job.status);
        const statusMessage = resolveStatusMessage(job, t);
        const statusClass = resolveStatusClass(job);
        return (
          <section
            key={job.previewId}
            className="rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {resolveHost(job.sourceUrl)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {job.sourceLang} -&gt; {job.targetLang}
                </p>
              </div>
              {!terminal ? (
                <div
                  aria-hidden
                  className="mt-0.5 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                />
              ) : null}
            </div>

            <p className={`mt-2 text-sm ${statusClass}`}>{statusMessage}</p>

            {job.status === "failed" ? (
              <p className="mt-1 text-xs text-muted-foreground">{t("try.center.retryHint")}</p>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              {job.status === "ready" && job.previewUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={job.previewUrl} target="_blank" rel="noreferrer">
                    {t("try.preview.open")}
                  </a>
                </Button>
              ) : null}

              {terminal ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    removePreviewStatusCenterJob(job.previewId);
                  }}
                >
                  {t("try.center.dismiss")}
                </Button>
              ) : null}
            </div>
          </section>
        );
      })}
    </aside>
  );
}
