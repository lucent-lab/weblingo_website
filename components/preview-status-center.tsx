"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createClientTranslator, type ClientMessages } from "@internal/i18n";
import {
  resolvePreviewStatusCenterCapacityHint,
  resolvePreviewStatusCenterMessage,
} from "@internal/previews/status-center-i18n";
import {
  getActivePreviewPinServerSnapshot,
  getActivePreviewPinSnapshot,
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  selectCurrentActivePreviewStatusCenterJob,
  subscribeActivePreviewPin,
  subscribePreviewStatusCenterStore,
} from "@internal/previews/status-center-store";

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

// Mirrors only the single current run so this toast can never disagree with the try
// form. Terminal outcomes are rendered by the form's terminal cards and by email.
export function PreviewStatusCenter({ messages }: PreviewStatusCenterProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);

  const jobsSnapshot = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterJobsSnapshot,
    getPreviewStatusCenterServerJobsSnapshot,
  );
  const pinnedPreviewId = useSyncExternalStore(
    subscribeActivePreviewPin,
    getActivePreviewPinSnapshot,
    getActivePreviewPinServerSnapshot,
  );
  const job = useMemo(
    () =>
      selectCurrentActivePreviewStatusCenterJob({
        jobs: jobsSnapshot,
        pinnedPreviewId,
      }),
    [jobsSnapshot, pinnedPreviewId],
  );

  if (!job) {
    return null;
  }

  const capacityHint = resolvePreviewStatusCenterCapacityHint(job, t);

  return (
    <aside
      className="fixed bottom-4 left-2 right-2 z-50 max-w-sm space-y-2 sm:left-auto sm:right-4"
      aria-live="polite"
    >
      <section className="rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {resolveHost(job.sourceUrl)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {job.sourceLang} -&gt; {job.targetLang}
            </p>
          </div>
          <div
            aria-hidden
            className="mt-0.5 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
        </div>

        <p className="mt-2 text-sm text-foreground">{resolvePreviewStatusCenterMessage(job, t)}</p>

        {capacityHint ? <p className="mt-1 text-xs text-muted-foreground">{capacityHint}</p> : null}
      </section>
    </aside>
  );
}
