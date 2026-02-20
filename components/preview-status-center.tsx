"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createClientTranslator, type ClientMessages } from "@internal/i18n";
import {
  resolvePreviewStatusCenterMessage,
  resolvePreviewStatusCenterTextClass,
} from "@internal/previews/status-center-i18n";
import {
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  isPreviewStatusCenterJobTerminal,
  removePreviewStatusCenterJob,
  selectJobsForStatusCenter,
  subscribePreviewStatusCenterStore,
} from "@internal/previews/status-center-store";
import { usePreviewStatusRuntime } from "@internal/previews/use-preview-status-runtime";

type PreviewStatusCenterProps = {
  messages: ClientMessages;
};

function resolveHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function PreviewStatusCenter({ messages }: PreviewStatusCenterProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  usePreviewStatusRuntime();

  const jobsSnapshot = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterJobsSnapshot,
    getPreviewStatusCenterServerJobsSnapshot,
  );
  const jobs = useMemo(() => selectJobsForStatusCenter(jobsSnapshot), [jobsSnapshot]);

  if (jobs.length === 0) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 left-2 right-2 z-50 max-w-sm space-y-2 sm:left-auto sm:right-4"
      aria-live="polite"
    >
      {jobs.map((job) => {
        const terminal = isPreviewStatusCenterJobTerminal(job.status);
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

            <p className={`mt-2 text-sm ${resolvePreviewStatusCenterTextClass(job)}`}>
              {resolvePreviewStatusCenterMessage(job, t)}
            </p>

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
