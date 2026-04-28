"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import {
  isPreviewStage,
  type PreviewErrorCode,
  type PreviewStage,
} from "@internal/previews/preview-sse";
import {
  resolvePreviewErrorPayload,
  resolvePreviewStatusDecision,
} from "@internal/previews/preview-status-decision";
import {
  parsePreviewRetryHint,
  type PreviewRetryHint,
} from "@internal/previews/preview-job-machine";
import {
  PREVIEW_STATUS_CENTER_ERROR_MESSAGE_KEYS,
  resolvePreviewStatusCenterErrorMessage,
  resolvePreviewStatusCenterMessage,
  resolvePreviewStatusCenterStageMessage,
} from "@internal/previews/status-center-i18n";
import {
  buildPreviewStatusCenterRequestKey,
  getPreviewStatusCenterJobsSnapshot,
  getPreviewStatusCenterServerJobsSnapshot,
  hydratePreviewStatusCenterStore,
  markPreviewStatusCenterJobTerminal,
  parsePreviewStatusCenterRequestKey,
  selectLatestActivePreviewStatusCenterJob,
  selectLatestJobByRequestKey,
  selectPreferredPreviewStatusCenterJob,
  subscribePreviewStatusCenterStore,
  upsertPreviewStatusCenterJob,
  updatePreviewStatusCenterJob,
  type PreviewStatusCenterJob,
} from "@internal/previews/status-center-store";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { z } from "zod";

type TryFormFieldLayout = "legacy" | "funnel";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
  supportedLanguages: SupportedLanguage[];
  showEmailField?: boolean;
  showInlineStatusText?: boolean;
  primaryButtonClassName?: string;
  fieldLayout?: TryFormFieldLayout;
};

type ConnectStatusUpdatesOptions = {
  sourceUrl?: string;
  sourceLang?: string;
  targetLang?: string;
  initialStatus?: "pending" | "processing";
  initialStage?: PreviewStage | null;
  initialPreviewUrl?: string;
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
  return "queued";
}

export function resolveTryFormMode(
  isCreating: boolean,
  trackedJob: PreviewStatusCenterJob | null,
): TryFormMode {
  if (trackedJob) {
    switch (trackedJob.status) {
      case "pending":
        return "running_pending";
      case "processing":
        return "running_processing";
      case "ready":
        return "terminal_ready";
      case "failed":
        return "terminal_failed";
      case "expired":
        return "terminal_expired";
    }
  }
  if (isCreating) {
    return "creating";
  }
  return "idle";
}

export function TryForm({
  locale,
  messages,
  disabled = false,
  supportedLanguages,
  showEmailField = false,
  showInlineStatusText = true,
  primaryButtonClassName,
  fieldLayout = "legacy",
}: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const resolveLanguageName = useMemo(() => createLanguageNameResolver(locale), [locale]);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timedOutWithEmail, setTimedOutWithEmail] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingEmailStatus, setPendingEmailStatus] = useState<
    "idle" | "submitting" | "saved" | "error"
  >("idle");
  const baseLocale = getBaseLangTag(locale) ?? locale.trim().toLowerCase();
  const defaultTargetLang = baseLocale === "en" ? "fr" : "en";
  const [sourceLang, setSourceLang] = useState<string>(locale);
  const [targetLang, setTargetLang] = useState<string>(defaultTargetLang);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const timedOutRef = useRef(false);
  const submittedEmailRef = useRef("");
  const restoreAttemptedRef = useRef(false);
  const trackedTryStartRef = useRef(false);
  const trackedPreviewIdsRef = useRef<Set<string>>(new Set());
  const trackedPreviewStatusSignaturesRef = useRef<Map<string, string>>(new Map());
  const trackedPreviewTerminalRef = useRef<Set<string>>(new Set());

  const trimmedUrl = url.trim();
  const submittedEmail = submittedEmailRef.current;
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
        sourceLang,
        targetLang,
      }),
    [trimmedUrl, sourceLang, targetLang],
  );

  const trackedJob = useMemo(
    () => selectLatestJobByRequestKey(lastRequestKey, jobs),
    [jobs, lastRequestKey],
  );
  const mode = useMemo(() => resolveTryFormMode(isCreating, trackedJob), [isCreating, trackedJob]);

  const isSameRequest = lastRequestKey !== null && currentRequestKey === lastRequestKey;
  const isPreviewRunning =
    mode === "creating" || mode === "running_pending" || mode === "running_processing";
  const isRequestInFlight = isPreviewRunning;
  const showInProgressCard = isPreviewRunning && !timedOut;
  const showGeneratingState = isSameRequest && mode === "creating";
  const showEditableControls = !isRequestInFlight;
  const isSameLanguage =
    Boolean(normalizedSourceLang) &&
    Boolean(normalizedTargetLang) &&
    normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase();
  const inputsDisabled = disabled;
  const isGenerateDisabled = inputsDisabled || !trimmedUrl || isSameLanguage;
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
    trackedJob && (trackedJob.status === "pending" || trackedJob.status === "processing")
      ? trackedJob.retryHint
      : null;
  const processingHintMessage = useMemo(() => {
    if (activeRetryHint?.reason !== "browser_capacity_exhausted") {
      return t("try.status.processingHint");
    }
    return showEmailField ? t("try.status.capacityEmailHint") : t("try.status.capacityHint");
  }, [activeRetryHint, showEmailField, t]);

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

    const restoredJob =
      selectLatestActivePreviewStatusCenterJob(jobs) ?? selectPreferredPreviewStatusCenterJob(jobs);
    if (!restoredJob) {
      return;
    }

    trackedPreviewIdsRef.current.add(restoredJob.previewId);
    if (
      restoredJob.status === "ready" ||
      restoredJob.status === "failed" ||
      restoredJob.status === "expired"
    ) {
      trackedPreviewTerminalRef.current.add(restoredJob.previewId);
      trackedPreviewStatusSignaturesRef.current.set(
        restoredJob.previewId,
        buildPreviewAnalyticsSignature(restoredJob),
      );
    } else {
      trackedPreviewTerminalRef.current.delete(restoredJob.previewId);
      trackedPreviewStatusSignaturesRef.current.delete(restoredJob.previewId);
    }

    setLastRequestKey(restoredJob.requestKey);
    setSubmissionError(null);
    timedOutRef.current = false;
    setTimedOut(false);
    setTimedOutWithEmail(false);

    const parsedRequest = parsePreviewStatusCenterRequestKey(restoredJob.requestKey);
    if (!parsedRequest) {
      return;
    }

    setUrl((current) => (current ? current : parsedRequest.sourceUrl));
    setSourceLang((current) => (current ? current : parsedRequest.sourceLang));
    setTargetLang((current) => (current ? current : parsedRequest.targetLang));
  }, [jobs, lastRequestKey]);

  useEffect(() => {
    if (
      trackedJob &&
      (trackedJob.status === "ready" ||
        trackedJob.status === "failed" ||
        trackedJob.status === "expired")
    ) {
      timedOutRef.current = false;
      setTimedOut(false);
      setTimedOutWithEmail(false);
    }
  }, [trackedJob]);

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
    }
  }, [fieldLayout, locale, trackedJob]);

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
    status: "pending" | "processing",
    stage: PreviewStage | null,
    retryHint?: PreviewRetryHint | null,
  ) {
    updatePreviewStatusCenterJob(previewId, {
      status,
      stage: stage ?? undefined,
      error: null,
      errorCode: null,
      errorStage: null,
      retryHint: retryHint ?? null,
    });
  }

  function syncStatusCenterTerminalState(
    previewId: string,
    status: "ready" | "failed" | "expired",
    options: {
      previewUrl?: string | null;
      error?: string | null;
      errorCode?: PreviewErrorCode | null;
      errorStage?: PreviewStage | null;
    } = {},
  ) {
    markPreviewStatusCenterJobTerminal(previewId, status, {
      previewUrl: options.previewUrl,
      error: options.error,
      errorCode: options.errorCode,
      errorStage: options.errorStage,
    });
  }

  function handleStartAnotherPreview() {
    closeEventSource();
    setLastRequestKey(null);
    setSubmissionError(null);
    timedOutRef.current = false;
    setTimedOut(false);
    setTimedOutWithEmail(false);
    setPendingEmailStatus("idle");
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
      const response = await fetch(
        `/api/previews/${previewId}?token=${encodeURIComponent(statusToken)}`,
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
        defaultErrorMessage: t("try.error.default"),
        resolveErrorMessage,
        mapNotFoundToErrorCode: true,
      });
      if (decision.kind === "terminal") {
        syncStatusCenterTerminalState(previewId, decision.status, {
          previewUrl: decision.previewUrl,
          error: decision.error,
          errorCode: decision.errorCode,
          errorStage: decision.errorStage,
        });
        setSubmissionError(null);
        timedOutRef.current = false;
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      }

      syncStatusCenterActiveState(previewId, decision.status, decision.stage, decision.retryHint);
      return false;
    } catch {
      syncStatusCenterActiveState(previewId, "processing", null);
      return false;
    } finally {
      if (mountedRef.current) {
        setCheckingStatus(false);
      }
    }
  }

  function connectSSE(previewId: string, statusToken: string) {
    closeEventSource();

    const es = new EventSource(
      `/api/previews/${previewId}/stream?token=${encodeURIComponent(statusToken)}`,
    );
    eventSourceRef.current = es;

    let lastEventAt = Date.now();
    const bump = () => {
      lastEventAt = Date.now();
    };

    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt <= 45_000) {
        return;
      }
      if (timedOutRef.current) {
        closeEventSource();
        return;
      }

      timedOutRef.current = true;
      setTimedOut(true);
      if (submittedEmailRef.current) {
        setTimedOutWithEmail(true);
      } else {
        setTimedOutWithEmail(false);
      }
      closeEventSource();
    }, 15_000);

    const handlePayload = (data: Record<string, unknown>) => {
      if (typeof data.previewUrl === "string") {
        updatePreviewStatusCenterJob(previewId, {
          previewUrl: data.previewUrl,
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
          error: decision.error,
          errorCode: decision.errorCode,
          errorStage: decision.errorStage,
        });
        closeEventSource();
        return;
      }

      syncStatusCenterActiveState(previewId, decision.status, decision.stage, decision.retryHint);
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
      const payload = parseEventPayload(event as MessageEvent);
      if (payload && typeof payload.previewUrl === "string") {
        syncStatusCenterTerminalState(previewId, "ready", {
          previewUrl: payload.previewUrl,
        });
      } else {
        syncStatusCenterTerminalState(previewId, "ready");
      }
      closeEventSource();
    });

    es.addEventListener("error", () => {
      closeEventSource();

      if (timedOutRef.current) {
        return;
      }

      const handleDisconnect = async () => {
        const terminal = await handleCheckStatus(previewId, statusToken);
        if (terminal) {
          return;
        }
        if (!mountedRef.current) {
          return;
        }

        timedOutRef.current = true;
        setTimedOut(true);
        if (submittedEmailRef.current) {
          setTimedOutWithEmail(true);
        } else {
          setTimedOutWithEmail(false);
        }
      };

      void handleDisconnect();
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
      retryHint: options.initialRetryHint ?? null,
      retryCount: 0,
    });

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

      if (!normalizedSourceLang || !normalizedTargetLang) {
        throw new Error("Source and target languages are required.");
      }
      if (normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase()) {
        throw new Error(t("try.form.sameLanguage"));
      }

      setUrlError(null);
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
      setTimedOut(false);
      setTimedOutWithEmail(false);
      timedOutRef.current = false;
      setPendingEmailStatus("idle");
      setPendingEmail("");

      closeEventSource();

      const requestKey = buildPreviewStatusCenterRequestKey({
        sourceUrl: trimmedUrl,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
      });
      setLastRequestKey(requestKey);

      const controller = new AbortController();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = controller;

      try {
        requestAttempted = true;
        const response = await fetch("/api/previews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceUrl: trimmedUrl,
            sourceLang: normalizedSourceLang,
            targetLang: normalizedTargetLang,
            locale,
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

        const payload = await response.json();
        const previewId = typeof payload?.previewId === "string" ? payload.previewId : null;
        const statusToken = typeof payload?.statusToken === "string" ? payload.statusToken : null;
        const immediatePreview =
          typeof payload?.previewUrl === "string" ? payload.previewUrl : null;

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
            });
            syncStatusCenterTerminalState(
              previewId,
              resolved.code === "preview_expired" ? "expired" : "failed",
              {
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

        if (payload?.status === "ready") {
          if (!previewId || !statusToken) {
            trackPreviewCreateFailed();
            setSubmissionError(t("try.error.default"));
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
              status: "ready",
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
          });
          syncStatusCenterTerminalState(previewId, "ready", {
            previewUrl: immediatePreview,
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
        captureAnalyticsEvent(
          ANALYTICS_EVENTS.previewCreateSucceeded,
          buildPreviewAnalyticsProperties({
            locale,
            sourceUrl: trimmedUrl,
            sourceLang: normalizedSourceLang,
            targetLang: normalizedTargetLang,
            previewId,
            status:
              payload?.status === "pending" || payload?.status === "processing"
                ? payload.status
                : "pending",
            stage: isPreviewStage(payload?.stage) ? payload.stage : null,
            retryHintReason: resolvePreviewRetryHint(payload)?.reason ?? null,
            fieldLayout,
          }),
        );
        connectStatusUpdates(previewId, statusToken, requestKey, {
          sourceUrl: trimmedUrl,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          initialStatus:
            payload?.status === "pending" || payload?.status === "processing"
              ? payload.status
              : "pending",
          initialStage: isPreviewStage(payload?.stage) ? payload.stage : null,
          initialPreviewUrl: immediatePreview ?? undefined,
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
      trackedTryStartRef.current = false;
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

  async function handleSubmitPendingEmail() {
    const trimmedPendingEmail = pendingEmail.trim();
    if (!trimmedPendingEmail || !isValidEmail(trimmedPendingEmail)) {
      return;
    }
    const previewId = trackedJob?.previewId;
    const statusToken = trackedJob?.statusToken;
    if (!previewId || !statusToken) {
      return;
    }
    setPendingEmailStatus("submitting");
    try {
      const response = await fetch(
        `/api/previews/${previewId}?token=${encodeURIComponent(statusToken)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedPendingEmail }),
        },
      );
      if (!response.ok) {
        setPendingEmailStatus("error");
        return;
      }
      submittedEmailRef.current = trimmedPendingEmail;
      captureAnalyticsEvent(
        ANALYTICS_EVENTS.previewEmailSaved,
        buildPreviewAnalyticsProperties({
          locale,
          sourceUrl: trackedJob?.sourceUrl ?? trimmedUrl,
          sourceLang: trackedJob?.sourceLang ?? normalizedSourceLang,
          targetLang: trackedJob?.targetLang ?? normalizedTargetLang,
          previewId,
          status: trackedJob?.status ?? null,
          fieldLayout,
        }),
      );
      setPendingEmailStatus("saved");
    } catch {
      setPendingEmailStatus("error");
    }
  }

  const isFunnelFieldLayout = fieldLayout === "funnel";

  return (
    <div className="space-y-6">
      {showEditableControls ? (
        <div className="flex flex-col gap-4">
          {isFunnelFieldLayout ? (
            <>
              <div className="flex flex-col gap-2">
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
              </div>

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
                <div className="flex flex-1 flex-col gap-2">
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
                </div>
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
            </>
          )}
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

              {showEmailField ? (
                <div className="max-w-sm space-y-3 border-t border-border/65 pt-4">
                  {pendingEmailStatus === "saved" ? (
                    <p className="text-sm font-medium text-foreground">
                      {t("try.pending.emailSaved")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {t("try.pending.emailPrompt")}
                      </p>
                      <Input
                        value={pendingEmail}
                        onChange={(event) => {
                          trackTryFormStarted();
                          setPendingEmail(event.currentTarget.value);
                        }}
                        placeholder={t("try.form.emailPlaceholder")}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        disabled={pendingEmailStatus === "submitting"}
                        className="h-9 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          pendingEmailStatus === "submitting" ||
                          !pendingEmail.trim() ||
                          !isValidEmail(pendingEmail)
                        }
                        onClick={() => void handleSubmitPendingEmail()}
                        className="w-fit"
                      >
                        {pendingEmailStatus === "submitting"
                          ? t("try.pending.emailSubmitting")
                          : t("try.pending.emailSubmit")}
                      </Button>
                      {pendingEmailStatus === "error" ? (
                        <p className="text-xs text-destructive">{t("try.pending.emailError")}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStartAnotherPreview}
                className="w-fit"
              >
                {t("try.action.startAnother")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {timedOut && timedOutWithEmail ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <p>{t("try.status.pendingEmail", undefined, { email: submittedEmail })}</p>
          <p className="mt-1 text-xs opacity-80">{t("try.status.pendingEmailHint")}</p>
        </div>
      ) : null}

      {timedOut && !timedOutWithEmail ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <p>{t("try.status.timedOutNoEmail")}</p>
          {showEmailField && pendingEmailStatus !== "saved" ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs">{t("try.pending.emailPrompt")}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Input
                  value={pendingEmail}
                  onChange={(event) => {
                    trackTryFormStarted();
                    setPendingEmail(event.currentTarget.value);
                  }}
                  placeholder={t("try.form.emailPlaceholder")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  disabled={pendingEmailStatus === "submitting"}
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    pendingEmailStatus === "submitting" ||
                    !pendingEmail.trim() ||
                    !isValidEmail(pendingEmail)
                  }
                  onClick={() => void handleSubmitPendingEmail()}
                  className="shrink-0"
                >
                  {pendingEmailStatus === "submitting"
                    ? t("try.pending.emailSubmitting")
                    : t("try.pending.emailSubmit")}
                </Button>
              </div>
              {pendingEmailStatus === "error" ? (
                <p className="text-xs text-destructive">{t("try.pending.emailError")}</p>
              ) : null}
            </div>
          ) : null}
          {showEmailField && pendingEmailStatus === "saved" ? (
            <p className="text-xs text-primary">{t("try.pending.emailSaved")}</p>
          ) : null}
          <Button
            onClick={() => {
              void handleCheckStatus();
            }}
            disabled={checkingStatus}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            {checkingStatus ? t("try.action.checkingStatus") : t("try.action.checkStatus")}
          </Button>
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
          </div>
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
        </div>
      ) : null}

      {mode === "terminal_ready" && trackedJob ? (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("try.status.ready")}</span>
              {trackedJob.previewUrl ? (
                <div className="flex flex-col gap-2 sm:flex-row">
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
                      {t("try.preview.openOverlay")}
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>

            {trackedJob.previewUrl ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-primary/80">
                  {t("try.preview.linkLabel")}
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
          </div>
        </div>
      ) : null}

      {!isRequestInFlight && isSameLanguage ? (
        <div className="text-sm text-destructive">{t("try.form.sameLanguage")}</div>
      ) : null}
    </div>
  );
}
