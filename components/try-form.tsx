"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Check, LoaderCircle } from "lucide-react";

// Avoid SSR for the combobox to prevent Radix Popover ID hydration mismatches.
const LanguageTagCombobox = dynamic(
  () => import("@/components/language-tag-combobox").then((mod) => mod.LanguageTagCombobox),
  { ssr: false },
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_EVENTS,
  buildPreviewAnalyticsProperties,
  captureAnalyticsEvent,
} from "@internal/analytics/client";
import {
  createClientTranslator,
  createLanguageNameResolver,
  getBaseLangTag,
  normalizeLangTag,
  type ClientMessages,
} from "@internal/i18n";
import { type PreviewErrorCode, type PreviewStage } from "@internal/previews/preview-sse";
import {
  resolvePreviewErrorPayload,
  resolvePreviewStatusDecision,
} from "@internal/previews/preview-status-decision";
import { withDemoDashboardLocale } from "@internal/previews/demo-dashboard-url";
import {
  isActivePreviewJobPhase,
  parsePreviewRetryHint,
  resolvePreviewRetryHintDelayMs,
  type ActivePreviewJobPhase,
  type PreviewRetryHint,
} from "@internal/previews/preview-job-machine";
import {
  buildPreviewJobStatusUrl,
  buildPreviewJobStreamUrl,
  resolvePreviewJobPayloadDemoDashboardUrl,
  resolvePreviewJobPayloadExpiresAt,
  resolvePreviewJobPayloadStage,
  resolvePreviewJobPayloadUrl,
} from "@internal/previews/preview-job-policy";
import {
  PREVIEW_STATUS_CENTER_ERROR_MESSAGE_KEYS,
  resolvePreviewCapacityHintMessage,
  resolvePreviewStatusCenterErrorMessage,
  resolvePreviewStatusCenterMessage,
  resolvePreviewStatusCenterStageMessage,
} from "@internal/previews/status-center-i18n";
import {
  buildPreviewStatusCenterRequestKey,
  clearActivePreviewIdFromSession,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  hydratePreviewStatusCenterStore,
  markPreviewStatusCenterJobTerminal,
  parsePreviewStatusCenterRequestKey,
  readActivePreviewIdFromSession,
  removePreviewStatusCenterJob,
  selectLatestJobByRequestKey,
  selectRestorablePreviewStatusCenterJob,
  subscribePreviewStatusCenterStore,
  upsertPreviewStatusCenterJob,
  updatePreviewStatusCenterJob,
  writeActivePreviewIdToSession,
  type PreviewStatusCenterJob,
} from "@internal/previews/status-center-store";
import type { SupportedLanguage } from "@internal/dashboard/webhook-contracts";
import { z } from "zod";

type TryFormFieldLayout = "legacy" | "funnel";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled: boolean;
  supportedLanguages: SupportedLanguage[];
  showInlineStatusText?: boolean;
  primaryButtonClassName?: string;
  fieldLayout?: TryFormFieldLayout;
};

type ConnectStatusUpdatesOptions = {
  sourceUrl?: string;
  sourceLang?: string;
  targetLang?: string;
  initialStatus?: ActivePreviewJobPhase;
  initialStage?: PreviewStage | null;
  initialPreviewUrl?: string;
  initialDemoDashboardUrl?: string;
  initialExpiresAt?: number | null;
  initialRetryHint?: PreviewRetryHint | null;
};

const emailSchema = z.email();

function isAbortLikeError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function buildPreviewAnalyticsSignature(job: PreviewStatusCenterJob): string {
  return JSON.stringify({
    status: job.status,
    stage: job.stage ?? null,
    errorCode: job.errorCode ?? null,
    errorStage: job.errorStage ?? null,
    retryHintReason: job.retryHint?.reason ?? null,
  });
}

export type TryFormMode =
  | "idle"
  | "creating"
  | "running_pending"
  | "running_processing"
  | "terminal_ready"
  | "terminal_failed"
  | "terminal_expired";

type PreviewProgressStepId = "queued" | "fetching" | "translating" | "rendering" | "ready";

type PreviewProgressStepState = "complete" | "current" | "upcoming";

type PreviewProgressStep = {
  id: PreviewProgressStepId;
  label: string;
  state: PreviewProgressStepState;
};

const PREVIEW_PROGRESS_STEP_ORDER: PreviewProgressStepId[] = [
  "queued",
  "fetching",
  "translating",
  "rendering",
  "ready",
];

function resolvePreviewRetryHint(payload: Record<string, unknown> | null): PreviewRetryHint | null {
  return parsePreviewRetryHint(payload?.retryHint);
}

function resolveInitialPreviewStatus(
  payload: Record<string, unknown> | null,
): ActivePreviewJobPhase {
  return isActivePreviewJobPhase(payload?.status) ? payload.status : "pending";
}

function resolveProspectShowcaseRef(payload: Record<string, unknown> | null): string | null {
  return typeof payload?.prospectShowcaseRef === "string" ? payload.prospectShowcaseRef : null;
}

function resolvePreviewProgressStepId(
  mode: TryFormMode,
  trackedJob: PreviewStatusCenterJob | null,
): PreviewProgressStepId {
  if (mode === "terminal_ready") {
    return "ready";
  }
  if (mode === "creating") {
    return "queued";
  }

  if (!trackedJob) {
    return "queued";
  }

  if (trackedJob.stage === "fetching_page" || trackedJob.stage === "analyzing_content") {
    return "fetching";
  }
  if (trackedJob.stage === "translating") {
    return "translating";
  }
  if (trackedJob.stage === "generating_preview" || trackedJob.stage === "saving") {
    return "rendering";
  }
  if (trackedJob.status === "processing") {
    return "translating";
  }
  if (trackedJob.status === "waiting_provider_capacity") {
    return "translating";
  }
  return "queued";
}

export function resolveTryFormMode(
  isCreating: boolean,
  trackedJob: PreviewStatusCenterJob | null,
): TryFormMode {
  if (trackedJob && isActivePreviewJobPhase(trackedJob.status)) {
    return trackedJob.status === "pending" ? "running_pending" : "running_processing";
  }
  if (trackedJob?.status === "ready") {
    return "terminal_ready";
  }
  if (trackedJob?.status === "failed") {
    return "terminal_failed";
  }
  if (trackedJob?.status === "expired") {
    return "terminal_expired";
  }
  if (isCreating) {
    return "creating";
  }
  return "idle";
}

export function TryForm({
  locale,
  messages,
  disabled,
  supportedLanguages,
  showInlineStatusText = true,
  primaryButtonClassName,
  fieldLayout = "legacy",
}: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const resolveLanguageName = useMemo(() => createLanguageNameResolver(locale), [locale]);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [restoredStatusRetryPreviewIds, setRestoredStatusRetryPreviewIds] = useState<Set<string>>(
    () => new Set(),
  );
  const baseLocale = getBaseLangTag(locale) ?? locale.trim().toLowerCase();
  const defaultTargetLang = baseLocale === "en" ? "fr" : "en";
  const [sourceLang, setSourceLang] = useState<string>(locale);
  const [targetLang, setTargetLang] = useState<string>(defaultTargetLang);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const restoreAttemptedRef = useRef(false);
  const trackedTryStartRef = useRef(false);
  const trackedPreviewIdsRef = useRef<Set<string>>(new Set());
  const trackedPreviewStatusSignaturesRef = useRef<Map<string, string>>(new Map());
  const trackedPreviewTerminalRef = useRef<Set<string>>(new Set());
  const restoredStatusCheckStartedRef = useRef<Set<string>>(new Set());
  const handleCheckStatusRef = useRef<
    (previewIdOverride?: string, statusTokenOverride?: string) => Promise<boolean | null>
  >(async () => null);
  const clearPreviewTracking = useCallback((previewId: string) => {
    trackedPreviewIdsRef.current.delete(previewId);
    trackedPreviewStatusSignaturesRef.current.delete(previewId);
    trackedPreviewTerminalRef.current.delete(previewId);
    restoredStatusCheckStartedRef.current.delete(previewId);
    setRestoredStatusRetryPreviewIds((current) => {
      if (!current.has(previewId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(previewId);
      return next;
    });
  }, []);

  const trimmedUrl = url.trim();
  const trimmedEmail = email.trim();
  const normalizedSourceLang = useMemo(
    () => normalizeLangTag(sourceLang) ?? sourceLang.trim(),
    [sourceLang],
  );
  const normalizedTargetLang = useMemo(
    () => normalizeLangTag(targetLang) ?? targetLang.trim(),
    [targetLang],
  );
  const supportedLanguageByTag = useMemo(() => {
    const map = new Map<string, SupportedLanguage>();
    for (const language of supportedLanguages) {
      map.set(language.tag, language);
    }
    return map;
  }, [supportedLanguages]);

  const jobs = useSyncExternalStore(
    subscribePreviewStatusCenterStore,
    getPreviewStatusCenterJobsSnapshot,
    getPreviewStatusCenterServerJobsSnapshot,
  );

  const currentRequestKey = useMemo(
    () =>
      buildPreviewStatusCenterRequestKey({
        sourceUrl: trimmedUrl,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        email: trimmedEmail,
      }),
    [normalizedSourceLang, normalizedTargetLang, trimmedEmail, trimmedUrl],
  );

  const trackedJob = useMemo(
    () => selectLatestJobByRequestKey(lastRequestKey, jobs),
    [jobs, lastRequestKey],
  );
  const mode = useMemo(() => resolveTryFormMode(isCreating, trackedJob), [isCreating, trackedJob]);
  const submittedEmail = useMemo(() => {
    if (!trackedJob) {
      return trimmedEmail;
    }
    const parsedRequest = parsePreviewStatusCenterRequestKey(trackedJob.requestKey);
    return parsedRequest?.email ? parsedRequest.email : trimmedEmail;
  }, [trackedJob, trimmedEmail]);

  const isSameRequest = lastRequestKey !== null && currentRequestKey === lastRequestKey;
  const isPreviewRunning =
    mode === "creating" || mode === "running_pending" || mode === "running_processing";
  const isStatusUnverified =
    trackedJob !== null &&
    isActivePreviewJobPhase(trackedJob.status) &&
    !trackedJob.remoteStatusVerified;
  // Never-verified jobs (fresh restore) show the restoring card; jobs that were
  // verified at least once keep the progress stepper through transport blips.
  const isRestoredStatusChecking =
    isStatusUnverified && trackedJob !== null && trackedJob.lastVerifiedAt === null;
  const isTransportDegraded =
    isStatusUnverified &&
    trackedJob !== null &&
    trackedJob.lastVerifiedAt !== null &&
    (restoredStatusRetryPreviewIds.has(trackedJob.previewId) || trackedJob.retryCount > 0);
  const isRequestInFlight = isPreviewRunning || isStatusUnverified;
  const isTerminalMode =
    mode === "terminal_ready" || mode === "terminal_failed" || mode === "terminal_expired";
  const showInProgressCard = isPreviewRunning && !isRestoredStatusChecking;
  const showRestoredStatusCheckingCard = isRestoredStatusChecking;
  const canRetryRestoredStatusCheck =
    trackedJob !== null &&
    isRestoredStatusChecking &&
    restoredStatusRetryPreviewIds.has(trackedJob.previewId);
  const showGeneratingState = isSameRequest && mode === "creating";
  const showEditableControls = !isRequestInFlight && !isTerminalMode;
  const isSameLanguage =
    Boolean(normalizedSourceLang) &&
    Boolean(normalizedTargetLang) &&
    normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase();
  const inputsDisabled = disabled;
  const isGenerateDisabled = inputsDisabled || !trimmedUrl || isSameLanguage || !trimmedEmail;
  const progressSteps = useMemo<PreviewProgressStep[]>(() => {
    const currentStepId = resolvePreviewProgressStepId(mode, trackedJob);
    const currentStepIndex = PREVIEW_PROGRESS_STEP_ORDER.indexOf(currentStepId);

    return PREVIEW_PROGRESS_STEP_ORDER.map((stepId, index) => {
      const labelKey =
        stepId === "queued"
          ? "try.progress.queued"
          : stepId === "fetching"
            ? "try.progress.fetching"
            : stepId === "translating"
              ? "try.progress.translating"
              : stepId === "rendering"
                ? "try.progress.rendering"
                : "try.progress.ready";
      const state =
        index < currentStepIndex ? "complete" : index === currentStepIndex ? "current" : "upcoming";
      return {
        id: stepId,
        label: t(labelKey),
        state,
      };
    });
  }, [mode, trackedJob, t]);
  const compactSourceUrl = useMemo(() => {
    if (!trimmedUrl) {
      return "";
    }

    try {
      const parsed = new URL(trimmedUrl);
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${parsed.host}${path}`;
    } catch {
      return trimmedUrl;
    }
  }, [trimmedUrl]);
  const sourceLanguageLabel = useMemo(() => {
    const fallbackEnglishName =
      supportedLanguageByTag.get(sourceLang)?.englishName ??
      supportedLanguageByTag.get(normalizedSourceLang)?.englishName ??
      null;
    return resolveLanguageName(sourceLang, { fallbackEnglishName });
  }, [normalizedSourceLang, resolveLanguageName, sourceLang, supportedLanguageByTag]);
  const targetLanguageLabel = useMemo(() => {
    const fallbackEnglishName =
      supportedLanguageByTag.get(targetLang)?.englishName ??
      supportedLanguageByTag.get(normalizedTargetLang)?.englishName ??
      null;
    return resolveLanguageName(targetLang, { fallbackEnglishName });
  }, [normalizedTargetLang, resolveLanguageName, supportedLanguageByTag, targetLang]);
  const requestSummary = useMemo(() => {
    const sourceLabel = sourceLanguageLabel || sourceLang;
    const targetLabel = targetLanguageLabel || targetLang;

    return compactSourceUrl
      ? `${compactSourceUrl} • ${sourceLabel} -> ${targetLabel}`
      : `${sourceLabel} -> ${targetLabel}`;
  }, [compactSourceUrl, sourceLang, sourceLanguageLabel, targetLang, targetLanguageLabel]);
  const currentProgressStepIndex = useMemo(
    () => progressSteps.findIndex((step) => step.state === "current"),
    [progressSteps],
  );
  const progressLineFillPercentage = useMemo(() => {
    if (progressSteps.length <= 1 || currentProgressStepIndex < 0) {
      return 0;
    }
    return (currentProgressStepIndex / (progressSteps.length - 1)) * 100;
  }, [currentProgressStepIndex, progressSteps.length]);
  const activeRetryHint =
    trackedJob && trackedJob.remoteStatusVerified && isActivePreviewJobPhase(trackedJob.status)
      ? trackedJob.retryHint
      : null;
  const processingHintMessage = useMemo(() => {
    return (
      resolvePreviewCapacityHintMessage(activeRetryHint?.reason, t, {
        browser: "try.status.capacityHint",
        provider: "try.status.providerCapacityHint",
      }) ?? t("try.status.processingHint")
    );
  }, [activeRetryHint, t]);

  const statusMessage = useMemo(() => {
    switch (mode) {
      case "creating":
        return t("try.status.creating") || "Creating preview...";
      case "running_pending":
      case "running_processing":
        return trackedJob ? resolvePreviewStatusCenterMessage(trackedJob, t) : null;
      case "idle":
      case "terminal_ready":
      case "terminal_failed":
      case "terminal_expired":
        return null;
    }
  }, [mode, trackedJob, t]);

  const resolvedError = useMemo(() => {
    if (submissionError) {
      return submissionError;
    }
    if (trackedJob && (trackedJob.status === "failed" || trackedJob.status === "expired")) {
      return resolvePreviewStatusCenterErrorMessage(trackedJob, t);
    }
    return null;
  }, [submissionError, trackedJob, t]);

  const errorStageMessage = useMemo(() => {
    if (!trackedJob || (trackedJob.status !== "failed" && trackedJob.status !== "expired")) {
      return null;
    }
    return resolvePreviewStatusCenterStageMessage(trackedJob.errorStage, t);
  }, [trackedJob, t]);

  useEffect(() => {
    hydratePreviewStatusCenterStore();
  }, []);

  useEffect(() => {
    if (restoreAttemptedRef.current) {
      return;
    }
    if (lastRequestKey) {
      return;
    }
    if (jobs.length === 0) {
      return;
    }
    restoreAttemptedRef.current = true;

    const restoredJob = selectRestorablePreviewStatusCenterJob({
      jobs,
      currentRequestKey: trimmedUrl ? currentRequestKey : null,
      pinnedPreviewId: readActivePreviewIdFromSession(),
    });
    if (!restoredJob) {
      return;
    }
    writeActivePreviewIdToSession(restoredJob.previewId);

    if (isActivePreviewJobPhase(restoredJob.status)) {
      trackedPreviewIdsRef.current.add(restoredJob.previewId);
      trackedPreviewTerminalRef.current.delete(restoredJob.previewId);
      trackedPreviewStatusSignaturesRef.current.delete(restoredJob.previewId);
    } else {
      clearPreviewTracking(restoredJob.previewId);
    }

    setLastRequestKey(restoredJob.requestKey);
    setSubmissionError(null);

    const parsedRequest = parsePreviewStatusCenterRequestKey(restoredJob.requestKey);
    if (!parsedRequest) {
      return;
    }

    setUrl((current) => (current ? current : parsedRequest.sourceUrl));
    setSourceLang((current) => (current ? current : parsedRequest.sourceLang));
    setTargetLang((current) => (current ? current : parsedRequest.targetLang));
    setEmail((current) => (current ? current : parsedRequest.email));
  }, [clearPreviewTracking, currentRequestKey, jobs, lastRequestKey, trimmedUrl]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setHasCopied(false);
  }, [trackedJob?.previewUrl]);

  useEffect(() => {
    if (!trackedJob) {
      return;
    }
    if (!trackedPreviewIdsRef.current.has(trackedJob.previewId)) {
      return;
    }
    if (!trackedJob.remoteStatusVerified) {
      return;
    }

    const signature = buildPreviewAnalyticsSignature(trackedJob);
    const previousSignature = trackedPreviewStatusSignaturesRef.current.get(trackedJob.previewId);
    if (previousSignature === signature) {
      return;
    }

    trackedPreviewStatusSignaturesRef.current.set(trackedJob.previewId, signature);
    captureAnalyticsEvent(
      ANALYTICS_EVENTS.previewStatusTransition,
      buildPreviewAnalyticsProperties({
        locale,
        sourceUrl: trackedJob.sourceUrl,
        sourceLang: trackedJob.sourceLang,
        targetLang: trackedJob.targetLang,
        previewId: trackedJob.previewId,
        status: trackedJob.status,
        stage: trackedJob.stage,
        errorCode: trackedJob.errorCode,
        errorStage: trackedJob.errorStage,
        retryHintReason: trackedJob.retryHint?.reason ?? null,
        fieldLayout,
      }),
    );

    if (trackedPreviewTerminalRef.current.has(trackedJob.previewId)) {
      return;
    }

    if (trackedJob.status === "ready") {
      trackedPreviewTerminalRef.current.add(trackedJob.previewId);
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.previewReady,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trackedJob.sourceUrl,
          sourceLang: trackedJob.sourceLang,
          targetLang: trackedJob.targetLang,
          previewId: trackedJob.previewId,
          status: trackedJob.status,
          stage: trackedJob.stage,
          fieldLayout,
        }),
      );
      clearPreviewTracking(trackedJob.previewId);
      return;
    }

    if (trackedJob.status === "failed" || trackedJob.status === "expired") {
      trackedPreviewTerminalRef.current.add(trackedJob.previewId);
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.previewFailed,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trackedJob.sourceUrl,
          sourceLang: trackedJob.sourceLang,
          targetLang: trackedJob.targetLang,
          previewId: trackedJob.previewId,
          status: trackedJob.status,
          stage: trackedJob.stage,
          errorCode: trackedJob.errorCode,
          errorStage: trackedJob.errorStage,
          fieldLayout,
        }),
      );
      clearPreviewTracking(trackedJob.previewId);
    }
  }, [clearPreviewTracking, fieldLayout, locale, trackedJob]);

  function closeEventSource() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function isValidHttpUrl(candidate: string) {
    try {
      const parsed = new URL(candidate.trim());
      if (!parsed.hostname) {
        return false;
      }
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function isValidEmail(candidate: string) {
    return emailSchema.safeParse(candidate.trim()).success;
  }

  function validateUrl(value: string): string | null {
    if (!value.trim() || !isValidHttpUrl(value)) {
      return t("try.form.invalidUrl");
    }
    return null;
  }

  function validateEmail(value: string): string | null {
    if (!value.trim()) {
      return t("try.form.emailRequired");
    }
    if (!isValidEmail(value)) {
      return t("try.form.emailInvalid");
    }
    return null;
  }

  function resolveErrorMessage(code: PreviewErrorCode | null, fallback?: string | null) {
    if (code) {
      return t(PREVIEW_STATUS_CENTER_ERROR_MESSAGE_KEYS[code]);
    }
    if (fallback) {
      return fallback;
    }
    return t("try.error.default");
  }

  function resolveErrorFromPayload(data: Record<string, unknown>, fallback?: string) {
    return resolvePreviewErrorPayload(
      data,
      fallback ?? t("try.error.default"),
      resolveErrorMessage,
    );
  }

  function syncStatusCenterActiveState(
    previewId: string,
    status: ActivePreviewJobPhase,
    stage: PreviewStage | null,
    retryHint?: PreviewRetryHint | null,
    remoteStatusVerified = true,
    expiresAt?: number | null,
  ) {
    const retryHintDelayMs = remoteStatusVerified
      ? resolvePreviewRetryHintDelayMs(retryHint)
      : null;
    const nextPollAt =
      remoteStatusVerified && retryHintDelayMs === null
        ? Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS
        : retryHintDelayMs === null
          ? undefined
          : Date.now() + retryHintDelayMs;
    updatePreviewStatusCenterJob(previewId, {
      status,
      stage: stage ?? undefined,
      error: null,
      errorCode: null,
      errorStage: null,
      retryHint: retryHint ?? null,
      remoteStatusVerified,
      expiresAt,
      ...(nextPollAt === undefined ? {} : { nextPollAt }),
    });
  }

  function syncStatusCenterTransientRetry(previewId: string) {
    const existing = getPreviewStatusCenterJobsSnapshot().find(
      (job) => job.previewId === previewId,
    );
    if (existing && isActivePreviewJobPhase(existing.status)) {
      syncStatusCenterActiveState(
        previewId,
        existing.status,
        existing.stage,
        existing.retryHint,
        false,
      );
      return;
    }
    syncStatusCenterActiveState(previewId, "processing", null, null, false);
  }

  function syncStatusCenterTerminalState(
    previewId: string,
    status: "ready" | "failed" | "expired",
    options: {
      previewUrl?: string | null;
      demoDashboardUrl?: string | null;
      expiresAt?: number | null;
      error?: string | null;
      errorCode?: PreviewErrorCode | null;
      errorStage?: PreviewStage | null;
    } = {},
  ) {
    const patch: NonNullable<Parameters<typeof markPreviewStatusCenterJobTerminal>[2]> = {};
    if (options.previewUrl !== undefined) {
      patch.previewUrl = options.previewUrl;
    }
    if (options.demoDashboardUrl !== undefined) {
      patch.demoDashboardUrl = options.demoDashboardUrl;
    }
    if (options.expiresAt !== undefined) {
      patch.expiresAt = options.expiresAt;
    }
    if (options.error !== undefined) {
      patch.error = options.error;
    }
    if (options.errorCode !== undefined) {
      patch.errorCode = options.errorCode;
    }
    if (options.errorStage !== undefined) {
      patch.errorStage = options.errorStage;
    }
    markPreviewStatusCenterJobTerminal(previewId, status, patch);
  }

  function markRestoredStatusCheckRetryAvailable(previewId: string) {
    restoredStatusCheckStartedRef.current.delete(previewId);
    setRestoredStatusRetryPreviewIds((current) => {
      const next = new Set(current);
      next.add(previewId);
      return next;
    });
  }

  function clearRestoredStatusCheckRetry(previewId: string) {
    setRestoredStatusRetryPreviewIds((current) => {
      if (!current.has(previewId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(previewId);
      return next;
    });
  }

  // Terminal-state reset: clears the finished job and starts a fresh form while
  // keeping the already-collected email.
  function handleTranslateAnother() {
    closeEventSource();
    if (trackedJob) {
      removePreviewStatusCenterJob(trackedJob.previewId);
      clearPreviewTracking(trackedJob.previewId);
      clearActivePreviewIdFromSession(trackedJob.previewId);
    }
    setLastRequestKey(null);
    setSubmissionError(null);
    setUrl("");
    setUrlError(null);
  }

  async function handleCheckStatus(
    previewIdOverride?: string,
    statusTokenOverride?: string,
  ): Promise<boolean | null> {
    const previewId = previewIdOverride ?? trackedJob?.previewId ?? null;
    const statusToken = statusTokenOverride ?? trackedJob?.statusToken ?? null;

    if (!previewId || !statusToken || checkingStatus) {
      return null;
    }

    if (!mountedRef.current) {
      return null;
    }
    setCheckingStatus(true);
    try {
      const response = await fetch(buildPreviewJobStatusUrl(previewId, statusToken));
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
        defaultErrorMessage: t("try.error.default"),
        resolveErrorMessage,
        mapNotFoundToErrorCode: true,
      });
      if (decision.kind === "terminal") {
        syncStatusCenterTerminalState(previewId, decision.status, {
          previewUrl: decision.previewUrl,
          demoDashboardUrl: decision.demoDashboardUrl,
          expiresAt: decision.expiresAt,
          error: decision.error,
          errorCode: decision.errorCode,
          errorStage: decision.errorStage,
        });
        setSubmissionError(null);
        clearRestoredStatusCheckRetry(previewId);
        return true;
      }

      if (decision.remoteStatusVerified) {
        syncStatusCenterActiveState(
          previewId,
          decision.status,
          decision.stage,
          decision.retryHint,
          true,
          decision.expiresAt,
        );
      } else {
        syncStatusCenterTransientRetry(previewId);
      }
      if (decision.remoteStatusVerified) {
        setSubmissionError(null);
        clearRestoredStatusCheckRetry(previewId);
      } else {
        markRestoredStatusCheckRetryAvailable(previewId);
      }
      return false;
    } catch {
      syncStatusCenterTransientRetry(previewId);
      markRestoredStatusCheckRetryAvailable(previewId);
      return false;
    } finally {
      if (mountedRef.current) {
        setCheckingStatus(false);
      }
    }
  }

  handleCheckStatusRef.current = handleCheckStatus;

  useEffect(() => {
    if (!trackedJob || trackedJob.remoteStatusVerified) {
      return;
    }
    if (!isActivePreviewJobPhase(trackedJob.status)) {
      return;
    }
    if (checkingStatus) {
      return;
    }
    if (restoredStatusRetryPreviewIds.has(trackedJob.previewId)) {
      return;
    }
    if (restoredStatusCheckStartedRef.current.has(trackedJob.previewId)) {
      return;
    }

    restoredStatusCheckStartedRef.current.add(trackedJob.previewId);
    void handleCheckStatusRef.current(trackedJob.previewId, trackedJob.statusToken);
  }, [checkingStatus, restoredStatusRetryPreviewIds, trackedJob]);

  function handleRetryRestoredStatusCheck() {
    if (!trackedJob || !isStatusUnverified) {
      return;
    }
    const previewId = trackedJob.previewId;
    clearRestoredStatusCheckRetry(previewId);
    restoredStatusCheckStartedRef.current.add(previewId);
    void handleCheckStatus(trackedJob.previewId, trackedJob.statusToken);
  }

  function connectSSE(previewId: string, statusToken: string) {
    closeEventSource();

    const es = new EventSource(buildPreviewJobStreamUrl(previewId, statusToken));
    eventSourceRef.current = es;

    let lastEventAt = Date.now();
    const bump = () => {
      lastEventAt = Date.now();
    };

    // SSE going quiet is a transport event: drop the stream and let the global
    // poll runtime keep the job updated; the progress stepper stays untouched.
    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt <= 45_000) {
        return;
      }
      closeEventSource();
      void handleCheckStatus(previewId, statusToken);
    }, 15_000);

    const handlePayload = (data: Record<string, unknown>) => {
      const payloadPreviewUrl = resolvePreviewJobPayloadUrl(data);
      const payloadDemoDashboardUrl = resolvePreviewJobPayloadDemoDashboardUrl(data);
      const payloadExpiresAt = resolvePreviewJobPayloadExpiresAt(data);
      if (payloadPreviewUrl || payloadDemoDashboardUrl || payloadExpiresAt !== null) {
        updatePreviewStatusCenterJob(previewId, {
          previewUrl: payloadPreviewUrl ?? undefined,
          demoDashboardUrl: payloadDemoDashboardUrl ?? undefined,
          expiresAt: payloadExpiresAt ?? undefined,
        });
      }

      const decision = resolvePreviewStatusDecision({
        responseOk: true,
        responseStatus: 200,
        payload: data,
        defaultErrorMessage: t("try.error.default"),
        resolveErrorMessage,
      });
      if (decision.kind === "terminal") {
        syncStatusCenterTerminalState(previewId, decision.status, {
          previewUrl: decision.previewUrl,
          demoDashboardUrl: decision.demoDashboardUrl,
          expiresAt: decision.expiresAt,
          error: decision.error,
          errorCode: decision.errorCode,
          errorStage: decision.errorStage,
        });
        closeEventSource();
        return;
      }

      syncStatusCenterActiveState(
        previewId,
        decision.status,
        decision.stage,
        decision.retryHint,
        true,
        decision.expiresAt,
      );
    };

    const parseEventPayload = (event: MessageEvent | Event): Record<string, unknown> | null => {
      if (!("data" in event) || typeof event.data !== "string") {
        return null;
      }
      try {
        return JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    es.addEventListener("progress", (event) => {
      bump();
      const payload = parseEventPayload(event as MessageEvent);
      if (!payload) {
        return;
      }
      handlePayload(payload);
    });

    es.addEventListener("status", (event) => {
      bump();
      const payload = parseEventPayload(event as MessageEvent);
      if (!payload) {
        return;
      }
      handlePayload(payload);
    });

    es.addEventListener("message", (event) => {
      bump();
      const payload = parseEventPayload(event as MessageEvent);
      if (!payload) {
        return;
      }
      handlePayload(payload);
    });

    es.addEventListener("heartbeat", () => {
      bump();
    });

    es.addEventListener("complete", (event) => {
      bump();
      const payload = parseEventPayload(event as MessageEvent);
      const payloadPreviewUrl = resolvePreviewJobPayloadUrl(payload);
      const payloadDemoDashboardUrl = resolvePreviewJobPayloadDemoDashboardUrl(payload);
      const payloadExpiresAt = resolvePreviewJobPayloadExpiresAt(payload);
      if (payload) {
        const decision = resolvePreviewStatusDecision({
          responseOk: true,
          responseStatus: 200,
          payload,
          defaultErrorMessage: t("try.error.default"),
          resolveErrorMessage,
        });
        if (decision.kind === "terminal") {
          syncStatusCenterTerminalState(previewId, decision.status, {
            previewUrl: decision.previewUrl ?? payloadPreviewUrl ?? undefined,
            demoDashboardUrl: decision.demoDashboardUrl ?? payloadDemoDashboardUrl ?? undefined,
            expiresAt: decision.expiresAt ?? payloadExpiresAt ?? undefined,
            error: decision.error,
            errorCode: decision.errorCode,
            errorStage: decision.errorStage,
          });
          closeEventSource();
          return;
        }
      }
      if (payloadPreviewUrl || payloadDemoDashboardUrl) {
        syncStatusCenterTerminalState(previewId, "ready", {
          previewUrl: payloadPreviewUrl ?? undefined,
          demoDashboardUrl: payloadDemoDashboardUrl ?? undefined,
          expiresAt: payloadExpiresAt ?? undefined,
        });
      } else {
        syncStatusCenterActiveState(
          previewId,
          "processing",
          resolvePreviewJobPayloadStage(payload?.stage),
          parsePreviewRetryHint(payload?.retryHint),
          true,
          payloadExpiresAt ?? undefined,
        );
        void handleCheckStatus(previewId, statusToken);
      }
      closeEventSource();
    });

    es.addEventListener("error", () => {
      // Transport event only: fall back silently to status polling.
      closeEventSource();
      void handleCheckStatus(previewId, statusToken);
    });
  }

  function connectStatusUpdates(
    previewId: string,
    statusToken: string,
    requestKey: string,
    options: ConnectStatusUpdatesOptions = {},
  ) {
    const parsedRequest = parsePreviewStatusCenterRequestKey(requestKey);

    upsertPreviewStatusCenterJob({
      previewId,
      requestKey,
      statusToken,
      sourceUrl: options.sourceUrl ?? parsedRequest?.sourceUrl ?? trimmedUrl,
      sourceLang: options.sourceLang ?? parsedRequest?.sourceLang ?? normalizedSourceLang,
      targetLang: options.targetLang ?? parsedRequest?.targetLang ?? normalizedTargetLang,
      status: options.initialStatus ?? "pending",
      stage: options.initialStage ?? null,
      error: null,
      errorCode: null,
      errorStage: null,
      previewUrl: options.initialPreviewUrl,
      demoDashboardUrl: options.initialDemoDashboardUrl,
      expiresAt: options.initialExpiresAt,
      retryHint: options.initialRetryHint ?? null,
      remoteStatusVerified: true,
      retryCount: 0,
    });
    writeActivePreviewIdToSession(previewId);

    if (typeof window === "undefined" || typeof window.EventSource !== "function") {
      void handleCheckStatus(previewId, statusToken);
      return;
    }

    connectSSE(previewId, statusToken);
  }

  function trackTryFormStarted(overrides?: {
    sourceUrl?: string;
    sourceLang?: string;
    targetLang?: string;
  }) {
    if (trackedTryStartRef.current) {
      return;
    }
    trackedTryStartRef.current = true;
    captureAnalyticsEvent(
      ANALYTICS_EVENTS.tryFormStarted,
      buildPreviewAnalyticsProperties({
        locale,
        sourceUrl: overrides?.sourceUrl ?? trimmedUrl,
        sourceLang: overrides?.sourceLang ?? normalizedSourceLang,
        targetLang: overrides?.targetLang ?? normalizedTargetLang,
        fieldLayout,
      }),
    );
  }

  async function handleGenerate() {
    if (!trimmedUrl || disabled) {
      return;
    }

    let requestAttempted = false;
    let previewCreateFailureTracked = false;
    const trackPreviewCreateFailed = (overrides?: {
      previewId?: string | null;
      errorCode?: string | null;
      errorStage?: string | null;
    }) => {
      previewCreateFailureTracked = true;
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.previewCreateFailed,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trimmedUrl,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          previewId: overrides?.previewId ?? null,
          errorCode: overrides?.errorCode ?? null,
          errorStage: overrides?.errorStage ?? null,
          fieldLayout,
        }),
      );
    };

    try {
      if (!isValidHttpUrl(trimmedUrl)) {
        const message = t("try.form.invalidUrl");
        setUrlError(message);
        throw new Error(message);
      }

      const emailValidation = validateEmail(trimmedEmail);
      if (emailValidation) {
        setEmailError(emailValidation);
        throw new Error(emailValidation);
      }

      if (!normalizedSourceLang || !normalizedTargetLang) {
        throw new Error("Source and target languages are required.");
      }
      if (normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase()) {
        throw new Error(t("try.form.sameLanguage"));
      }

      setUrlError(null);
      setEmailError(null);
      setSubmissionError(null);
      setIsCreating(true);
      trackTryFormStarted();
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.tryFormSubmitted,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trimmedUrl,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          fieldLayout,
        }),
      );

      closeEventSource();

      const requestKey = buildPreviewStatusCenterRequestKey({
        sourceUrl: trimmedUrl,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        email: trimmedEmail,
      });

      // One preview at a time: identical in-flight requests are deduped by the
      // create endpoint itself, which returns the existing prospectShowcaseRef
      // with a freshly rotated statusToken. Reattaching from local state would
      // keep a stale token when another tab already rotated it.
      if (trackedJob && !isActivePreviewJobPhase(trackedJob.status)) {
        removePreviewStatusCenterJob(trackedJob.previewId);
        clearPreviewTracking(trackedJob.previewId);
        clearActivePreviewIdFromSession(trackedJob.previewId);
      }
      setLastRequestKey(requestKey);

      const controller = new AbortController();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = controller;

      try {
        requestAttempted = true;
        const response = await fetch("/api/prospect-showcases", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceUrl: trimmedUrl,
            sourceLang: normalizedSourceLang,
            targetLang: normalizedTargetLang,
            locale,
            email: trimmedEmail,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const reason =
            payload?.error || payload?.message || `Request failed with status ${response.status}`;
          trackPreviewCreateFailed({
            errorCode: typeof payload?.errorCode === "string" ? payload.errorCode : null,
            errorStage: typeof payload?.errorStage === "string" ? payload.errorStage : null,
          });
          setSubmissionError(resolveErrorMessage(null, reason));
          return;
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const previewId = resolveProspectShowcaseRef(payload);
        const statusToken = typeof payload?.statusToken === "string" ? payload.statusToken : null;
        const immediatePreview = resolvePreviewJobPayloadUrl(payload);
        const immediateDemoDashboardUrl = resolvePreviewJobPayloadDemoDashboardUrl(payload);
        const expiresAt = resolvePreviewJobPayloadExpiresAt(payload);
        const immediateDecision = resolvePreviewStatusDecision({
          responseOk: true,
          responseStatus: response.status,
          payload,
          defaultErrorMessage: t("try.error.default"),
          resolveErrorMessage,
        });

        if (payload?.status === "failed") {
          if (previewId) {
            trackedPreviewIdsRef.current.add(previewId);
          }
          const resolved = resolveErrorFromPayload(payload);
          if (previewId && statusToken) {
            captureAnalyticsEvent(
              ANALYTICS_EVENTS.previewCreateSucceeded,
              buildPreviewAnalyticsProperties({
                locale,
                sourceUrl: trimmedUrl,
                sourceLang: normalizedSourceLang,
                targetLang: normalizedTargetLang,
                previewId,
                status: "failed",
                errorCode: resolved.code,
                errorStage: resolved.stage,
                fieldLayout,
              }),
            );
            upsertPreviewStatusCenterJob({
              previewId,
              requestKey,
              statusToken,
              sourceUrl: trimmedUrl,
              sourceLang: normalizedSourceLang,
              targetLang: normalizedTargetLang,
              status: "processing",
              expiresAt,
            });
            syncStatusCenterTerminalState(
              previewId,
              resolved.code === "preview_expired" ? "expired" : "failed",
              {
                previewUrl: immediatePreview ?? undefined,
                demoDashboardUrl: immediateDemoDashboardUrl ?? undefined,
                expiresAt: expiresAt ?? undefined,
                error: resolved.message,
                errorCode: resolved.code,
                errorStage: resolved.stage,
              },
            );
          } else {
            trackPreviewCreateFailed({
              errorCode: resolved.code,
              errorStage: resolved.stage,
            });
            setSubmissionError(resolved.message);
          }
          return;
        }

        if (immediateDecision.kind === "terminal") {
          if (!previewId || !statusToken) {
            trackPreviewCreateFailed({
              errorCode: immediateDecision.errorCode,
              errorStage: immediateDecision.errorStage,
            });
            setSubmissionError(immediateDecision.error ?? t("try.error.default"));
            return;
          }

          trackedPreviewIdsRef.current.add(previewId);
          trackedPreviewTerminalRef.current.delete(previewId);
          trackedPreviewStatusSignaturesRef.current.delete(previewId);
          captureAnalyticsEvent(
            ANALYTICS_EVENTS.previewCreateSucceeded,
            buildPreviewAnalyticsProperties({
              locale,
              sourceUrl: trimmedUrl,
              sourceLang: normalizedSourceLang,
              targetLang: normalizedTargetLang,
              previewId,
              status: immediateDecision.status,
              errorCode: immediateDecision.errorCode,
              errorStage: immediateDecision.errorStage,
              fieldLayout,
            }),
          );
          upsertPreviewStatusCenterJob({
            previewId,
            requestKey,
            statusToken,
            sourceUrl: trimmedUrl,
            sourceLang: normalizedSourceLang,
            targetLang: normalizedTargetLang,
            status: "pending",
            expiresAt,
          });
          syncStatusCenterTerminalState(previewId, immediateDecision.status, {
            previewUrl: immediateDecision.previewUrl ?? immediatePreview ?? undefined,
            demoDashboardUrl:
              immediateDecision.demoDashboardUrl ?? immediateDemoDashboardUrl ?? undefined,
            expiresAt: immediateDecision.expiresAt ?? expiresAt ?? undefined,
            error: immediateDecision.error ?? null,
            errorCode: immediateDecision.errorCode ?? null,
            errorStage: immediateDecision.errorStage ?? null,
          });
          return;
        }

        if (!previewId) {
          trackPreviewCreateFailed();
          throw new Error("Preview was created but no ID was returned.");
        }
        if (!statusToken) {
          trackPreviewCreateFailed({ previewId });
          throw new Error("Preview was created but no status token was returned.");
        }

        trackedPreviewIdsRef.current.add(previewId);
        trackedPreviewTerminalRef.current.delete(previewId);
        trackedPreviewStatusSignaturesRef.current.delete(previewId);
        const initialStatus = resolveInitialPreviewStatus(payload);
        captureAnalyticsEvent(
          ANALYTICS_EVENTS.previewCreateSucceeded,
          buildPreviewAnalyticsProperties({
            locale,
            sourceUrl: trimmedUrl,
            sourceLang: normalizedSourceLang,
            targetLang: normalizedTargetLang,
            previewId,
            status: initialStatus,
            stage: resolvePreviewJobPayloadStage(payload?.stage),
            retryHintReason: resolvePreviewRetryHint(payload)?.reason ?? null,
            fieldLayout,
          }),
        );
        connectStatusUpdates(previewId, statusToken, requestKey, {
          sourceUrl: trimmedUrl,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          initialStatus,
          initialStage: resolvePreviewJobPayloadStage(payload?.stage),
          initialPreviewUrl: immediatePreview ?? undefined,
          initialDemoDashboardUrl: immediateDemoDashboardUrl ?? undefined,
          initialExpiresAt: expiresAt,
          initialRetryHint: resolvePreviewRetryHint(payload),
        });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }
      if (requestAttempted && !previewCreateFailureTracked) {
        trackPreviewCreateFailed();
      }
      const message = error instanceof Error ? error.message : "Failed to generate preview.";
      setSubmissionError(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCopyPreview() {
    const previewUrl = trackedJob?.previewUrl;
    if (!previewUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(previewUrl);
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.previewCopyClicked,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trackedJob?.sourceUrl ?? trimmedUrl,
          sourceLang: trackedJob?.sourceLang ?? normalizedSourceLang,
          targetLang: trackedJob?.targetLang ?? normalizedTargetLang,
          previewId: trackedJob?.previewId ?? null,
          status: trackedJob?.status ?? null,
          fieldLayout,
        }),
      );
      setHasCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    } catch {
      setHasCopied(false);
    }
  }

  const isFunnelFieldLayout = fieldLayout === "funnel";

  return (
    <div className="space-y-6">
      {showEditableControls ? (
        <div className="flex flex-col gap-4">
          {isFunnelFieldLayout ? (
            <>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-foreground">{t("try.form.urlLabel")}</span>
                <Input
                  value={url}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setUrl(value);
                    if (urlError) {
                      setUrlError(validateUrl(value));
                    }
                  }}
                  onBlur={(event) => setUrlError(validateUrl(event.currentTarget.value))}
                  placeholder={t("try.form.placeholder")}
                  type="url"
                  pattern="https?://.*"
                  required
                  disabled={inputsDisabled}
                  aria-invalid={urlError ? "true" : "false"}
                />
                {urlError ? <div className="text-sm text-destructive">{urlError}</div> : null}
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">{t("try.form.sourceLabel")}</span>
                  <LanguageTagCombobox
                    value={sourceLang}
                    onValueChange={setSourceLang}
                    supportedLanguages={supportedLanguages}
                    displayLocale={locale}
                    disabled={inputsDisabled}
                    placeholder="en"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">{t("try.form.targetLabel")}</span>
                  <LanguageTagCombobox
                    value={targetLang}
                    onValueChange={setTargetLang}
                    supportedLanguages={supportedLanguages}
                    displayLocale={locale}
                    disabled={inputsDisabled}
                    placeholder={locale}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-foreground">{t("try.form.emailLabel")}</span>
                <Input
                  value={email}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setEmail(value);
                    if (emailError) {
                      setEmailError(validateEmail(value));
                    }
                  }}
                  onBlur={(event) => setEmailError(validateEmail(event.currentTarget.value))}
                  placeholder={t("try.form.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={inputsDisabled}
                  aria-invalid={emailError ? "true" : "false"}
                />
              </label>
              <span className="text-xs text-muted-foreground">{t("try.form.emailHint")}</span>
              {emailError ? <div className="text-sm text-destructive">{emailError}</div> : null}

              <Button
                className={primaryButtonClassName}
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
              >
                {showGeneratingState ? `${t("try.form.button")}…` : t("try.form.button")}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row">
                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">{t("try.form.urlLabel")}</span>
                  <Input
                    value={url}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      trackTryFormStarted({
                        sourceUrl: value,
                      });
                      setUrl(value);
                      if (urlError) {
                        setUrlError(validateUrl(value));
                      }
                    }}
                    onBlur={(event) => setUrlError(validateUrl(event.currentTarget.value))}
                    placeholder={t("try.form.placeholder")}
                    type="url"
                    pattern="https?://.*"
                    required
                    disabled={inputsDisabled}
                    aria-invalid={urlError ? "true" : "false"}
                  />
                  {urlError ? <div className="text-sm text-destructive">{urlError}</div> : null}
                </label>
                <Button
                  className={primaryButtonClassName}
                  onClick={handleGenerate}
                  disabled={isGenerateDisabled}
                >
                  {showGeneratingState ? `${t("try.form.button")}…` : t("try.form.button")}
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">{t("try.form.sourceLabel")}</span>
                  <LanguageTagCombobox
                    value={sourceLang}
                    onValueChange={(value) => {
                      trackTryFormStarted({
                        sourceLang: normalizeLangTag(value) ?? value.trim(),
                      });
                      setSourceLang(value);
                    }}
                    supportedLanguages={supportedLanguages}
                    displayLocale={locale}
                    disabled={inputsDisabled}
                    placeholder="en"
                  />
                </label>

                <label className="flex flex-1 flex-col gap-2 text-sm">
                  <span className="font-medium text-foreground">{t("try.form.targetLabel")}</span>
                  <LanguageTagCombobox
                    value={targetLang}
                    onValueChange={(value) => {
                      trackTryFormStarted({
                        targetLang: normalizeLangTag(value) ?? value.trim(),
                      });
                      setTargetLang(value);
                    }}
                    supportedLanguages={supportedLanguages}
                    displayLocale={locale}
                    disabled={inputsDisabled}
                    placeholder={locale}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-foreground">{t("try.form.emailLabel")}</span>
                <Input
                  value={email}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    trackTryFormStarted();
                    setEmail(value);
                    if (emailError) {
                      setEmailError(validateEmail(value));
                    }
                  }}
                  onBlur={(event) => setEmailError(validateEmail(event.currentTarget.value))}
                  placeholder={t("try.form.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={inputsDisabled}
                  aria-invalid={emailError ? "true" : "false"}
                />
              </label>
              <span className="text-xs text-muted-foreground">{t("try.form.emailHint")}</span>
              {emailError ? <div className="text-sm text-destructive">{emailError}</div> : null}
            </>
          )}
        </div>
      ) : null}

      {statusMessage && showRestoredStatusCheckingCard ? (
        <div className="space-y-4 pt-1">
          <p className="break-words text-sm font-medium text-foreground">{requestSummary}</p>
          <div className="space-y-1 rounded-md border border-border/70 bg-muted/35 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              <span>{statusMessage}</span>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground/90">
              {processingHintMessage}
            </p>
            {canRetryRestoredStatusCheck ? (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetryRestoredStatusCheck}
                  disabled={checkingStatus}
                >
                  {checkingStatus ? t("try.action.checkingStatus") : t("try.action.checkStatus")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {statusMessage && showInProgressCard ? (
        <div className="space-y-4 pt-1">
          <p className="break-words text-sm font-medium text-foreground">{requestSummary}</p>

          <div className="grid gap-5 md:grid-cols-[8.5rem_minmax(0,1fr)] md:items-start">
            <div className="relative md:pr-2">
              <span
                aria-hidden
                className="absolute left-[0.625rem] top-[0.625rem] bottom-[0.625rem] w-px bg-border/80"
              />
              <span
                aria-hidden
                className="absolute left-[0.625rem] top-[0.625rem] w-px bg-primary/35 transition-[height] duration-300 ease-out"
                style={{ height: `calc((100% - 1.25rem) * ${progressLineFillPercentage / 100})` }}
              />
              <ol aria-label={t("try.progress.label")} className="space-y-4">
                {progressSteps.map((step) => {
                  return (
                    <li
                      key={step.id}
                      aria-current={step.state === "current" ? "step" : undefined}
                      className="relative flex items-start gap-3"
                    >
                      <span
                        className={cn(
                          "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background",
                          step.state === "complete" &&
                            "border-primary bg-primary text-primary-foreground",
                          step.state === "current" &&
                            "border-primary bg-background text-primary shadow-[0_0_0_3px_rgba(124,92,218,0.12)]",
                          step.state === "upcoming" && "border-border text-muted-foreground",
                        )}
                      >
                        {step.state === "current" ? (
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-primary/35 animate-pulse"
                          />
                        ) : null}
                        {step.state === "complete" ? (
                          <Check className="h-3 w-3" />
                        ) : step.state === "current" ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                        )}
                      </span>

                      <span
                        className={cn(
                          "pt-0.5 text-sm leading-6",
                          step.state === "current" && "font-semibold text-primary",
                          step.state === "complete" && "text-foreground/90",
                          step.state === "upcoming" && "text-muted-foreground/55",
                        )}
                      >
                        {step.state === "current" ? (
                          <span className="inline-flex rounded-full bg-primary/12 px-2.5 py-0.5">
                            {step.label}
                          </span>
                        ) : (
                          step.label
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="space-y-4">
              {showInlineStatusText ? (
                <div className="space-y-1">
                  <span className="text-lg font-semibold text-foreground">{statusMessage}</span>
                  <p className="max-w-md text-xs leading-5 text-muted-foreground/90">
                    {processingHintMessage}
                  </p>
                </div>
              ) : null}

              <p className="max-w-md text-xs leading-5 text-muted-foreground/90">
                {t("try.status.emailNotice", undefined, { email: submittedEmail })}
              </p>
            </div>
          </div>

          {isTransportDegraded ? (
            <div className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <p>{t("try.status.statusUnreachable")}</p>
              <p className="text-xs opacity-80">
                {t("try.status.pendingEmail", undefined, { email: submittedEmail })}
              </p>
              <Button
                onClick={handleRetryRestoredStatusCheck}
                disabled={checkingStatus}
                variant="outline"
                size="sm"
                className="w-fit"
              >
                {checkingStatus ? t("try.action.checkingStatus") : t("try.action.checkStatus")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {resolvedError && !isCreating ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive">
          <div className="space-y-1">
            <div className="font-medium">{resolvedError}</div>
            {errorStageMessage ? (
              <div className="text-xs text-destructive/80">
                {t("try.error.stageLabel", undefined, { stage: errorStageMessage })}
              </div>
            ) : null}
            {trackedJob && (trackedJob.status === "failed" || trackedJob.status === "expired") ? (
              <div className="text-xs text-destructive/80">
                {t("try.error.referenceHint", undefined, { ref: trackedJob.previewId })}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                void handleGenerate();
              }}
              disabled={isGenerateDisabled || isCreating}
              variant="outline"
              size="sm"
              className="w-fit border-destructive/30 bg-background/80 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              {t("try.action.retry")}
            </Button>
            {isTerminalMode ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-fit"
                onClick={handleTranslateAnother}
              >
                {t("try.action.translateAnother")}
              </Button>
            ) : null}
            {trackedJob?.status === "failed" && trackedJob.previewUrl ? (
              <Button asChild size="sm" variant="secondary" className="w-fit">
                <a
                  href={trackedJob.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    captureAnalyticsEvent(
                      ANALYTICS_EVENTS.previewOpenClicked,
                      buildPreviewAnalyticsProperties({
                        locale,
                        sourceUrl: trackedJob.sourceUrl,
                        sourceLang: trackedJob.sourceLang,
                        targetLang: trackedJob.targetLang,
                        previewId: trackedJob.previewId,
                        status: trackedJob.status,
                        fieldLayout,
                      }),
                    );
                  }}
                >
                  {t("try.preview.viewShowcase")}
                </a>
              </Button>
            ) : null}
            {trackedJob?.status === "failed" && trackedJob.demoDashboardUrl ? (
              <Button asChild size="sm" variant="secondary" className="w-fit">
                <a
                  href={withDemoDashboardLocale(trackedJob.demoDashboardUrl, locale)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    captureAnalyticsEvent(
                      ANALYTICS_EVENTS.previewOpenClicked,
                      buildPreviewAnalyticsProperties({
                        locale,
                        sourceUrl: trackedJob.sourceUrl,
                        sourceLang: trackedJob.sourceLang,
                        targetLang: trackedJob.targetLang,
                        previewId: trackedJob.previewId,
                        status: trackedJob.status,
                        fieldLayout,
                      }),
                    );
                  }}
                >
                  {t("try.preview.openDemoDashboard")}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "terminal_ready" && trackedJob ? (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{resolvePreviewStatusCenterMessage(trackedJob, t)}</span>
              {trackedJob.previewUrl || trackedJob.demoDashboardUrl ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {trackedJob.previewUrl ? (
                    <Button asChild size="sm" variant="secondary" className="justify-center">
                      <a
                        href={trackedJob.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          captureAnalyticsEvent(
                            ANALYTICS_EVENTS.previewOpenClicked,
                            buildPreviewAnalyticsProperties({
                              locale,
                              sourceUrl: trackedJob.sourceUrl,
                              sourceLang: trackedJob.sourceLang,
                              targetLang: trackedJob.targetLang,
                              previewId: trackedJob.previewId,
                              status: trackedJob.status,
                              fieldLayout,
                            }),
                          );
                        }}
                      >
                        {t("try.preview.viewShowcase")}
                      </a>
                    </Button>
                  ) : null}
                  {trackedJob.demoDashboardUrl ? (
                    <Button asChild size="sm" className="justify-center">
                      <a
                        href={withDemoDashboardLocale(trackedJob.demoDashboardUrl, locale)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("try.preview.openDemoDashboard")}
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {trackedJob.previewUrl ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-primary/80">
                  {t("try.preview.showcaseLinkLabel")}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={trackedJob.previewUrl}
                    readOnly
                    className="h-9 text-xs text-foreground"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyPreview}>
                    {hasCopied ? t("try.preview.copied") : t("try.preview.copy")}
                  </Button>
                </div>
              </div>
            ) : null}

            <p className="text-xs text-primary/80">
              {t("try.preview.emailedNotice", undefined, { email: submittedEmail })}
            </p>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={handleTranslateAnother}
            >
              {t("try.action.translateAnother")}
            </Button>
          </div>
        </div>
      ) : null}

      {showEditableControls && isSameLanguage ? (
        <div className="text-sm text-destructive">{t("try.form.sameLanguage")}</div>
      ) : null}
    </div>
  );
}
