"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { createClientTranslator, type ClientMessages } from "@internal/i18n";
import { resolvePreviewStatusCenterMessage } from "@internal/previews/status-center-i18n";
import {
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  hydratePreviewStatusCenterStore,
  selectLatestActivePreviewStatusCenterJob,
  subscribePreviewStatusCenterStore,
} from "@internal/previews/status-center-store";

type TryPanelHeaderProps = {
  messages: ClientMessages;
};

export function TryPanelHeader({ messages }: TryPanelHeaderProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const jobs = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterJobsSnapshot,
    getPreviewStatusCenterServerJobsSnapshot,
  );

  useEffect(() => {
    hydratePreviewStatusCenterStore();
  }, []);

  const activeJob = useMemo(() => selectLatestActivePreviewStatusCenterJob(jobs), [jobs]);
  const isRunning = activeJob?.status === "pending" || activeJob?.status === "processing";
  const title = isRunning ? resolvePreviewStatusCenterMessage(activeJob, t) : t("try.header.title");
  const description = isRunning ? t("try.status.processingHint") : t("try.header.description");

  return (
    <>
      <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mb-6 text-xs leading-5 text-muted-foreground/90">{description}</p>
    </>
  );
}
