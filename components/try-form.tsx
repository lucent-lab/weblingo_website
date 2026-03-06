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
  createClientTranslator,
  createLanguageNameResolver,
  getBaseLangTag,
  normalizeLangTag,
  type ClientMessages,
} from "@internal/i18n";
import {
  hasExplicitFailure,
  isPreviewErrorCode,
  isPreviewStage,
  resolveStatusCheckFailure,
  type PreviewErrorCode,
  type PreviewStage,
} from "@internal/previews/preview-sse";
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
};

type ResolvedPreviewError = {
  code: PreviewErrorCode | null;
  stage: PreviewStage | null;
  message: string;
};

const emailSchema = z.email();

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
        index < currentStepIndex
          ? "complete"
          : index === currentStepIndex
            ? "current"
            : "upcoming";
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
    if (jobs.length === 0) {
      return;
    }
    restoreAttemptedRef.current = true;

    const restoredJob =
      selectLatestActivePreviewStatusCenterJob(jobs) ?? selectPreferredPreviewStatusCenterJob(jobs);
    if (!restoredJob) {
      return;
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
  }, [jobs]);

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

  function resolveErrorFromPayload(
    data: Record<string, unknown>,
    fallback?: string,
  ): ResolvedPreviewError {
    const details =
      data.details && typeof data.details === "object"
        ? (data.details as Record<string, unknown>)
        : null;
    const code = isPreviewErrorCode(data.errorCode)
      ? data.errorCode
      : details && isPreviewErrorCode(details.errorCode)
        ? details.errorCode
        : null;
    const stage = isPreviewStage(data.errorStage)
      ? data.errorStage
      : details && isPreviewStage(details.errorStage)
        ? details.errorStage
        : null;
    const message = resolveErrorMessage(
      code,
      (data.error as string | undefined) ??
        (data.message as string | undefined) ??
        fallback ??
        null,
    );
    return {
      code,
      stage,
      message,
    };
  }

  function syncStatusCenterActiveState(
    previewId: string,
    status: "pending" | "processing",
    stage: PreviewStage | null,
  ) {
    updatePreviewStatusCenterJob(previewId, {
      status,
      stage: stage ?? undefined,
      error: null,
      errorCode: null,
      errorStage: null,
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

      if (!response.ok) {
        const decision = resolveStatusCheckFailure(response.status, payload);
        if (decision === "processing") {
          syncStatusCenterActiveState(previewId, "processing", null);
          return false;
        }

        const reason =
          (payload && typeof payload.error === "string" ? payload.error : "") ||
          (payload && typeof payload.message === "string" ? payload.message : "") ||
          t("try.error.default");
        const resolved = resolveErrorFromPayload(payload ?? {}, reason);
        syncStatusCenterTerminalState(
          previewId,
          resolved.code === "preview_expired" ? "expired" : "failed",
          {
            error: resolved.message,
            errorCode: resolved.code,
            errorStage: resolved.stage,
          },
        );
        setSubmissionError(null);
        timedOutRef.current = false;
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      }

      if (!payload || typeof payload !== "object") {
        syncStatusCenterActiveState(previewId, "processing", null);
        return false;
      }

      if (payload.status === "ready") {
        syncStatusCenterTerminalState(previewId, "ready", {
          previewUrl: typeof payload.previewUrl === "string" ? payload.previewUrl : null,
        });
        setSubmissionError(null);
        timedOutRef.current = false;
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      }

      if (payload.status === "failed" || hasExplicitFailure(payload)) {
        const resolved = resolveErrorFromPayload(payload, t("try.error.default"));
        syncStatusCenterTerminalState(
          previewId,
          resolved.code === "preview_expired" ? "expired" : "failed",
          {
            error: resolved.message,
            errorCode: resolved.code,
            errorStage: resolved.stage,
          },
        );
        setSubmissionError(null);
        timedOutRef.current = false;
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      }

      syncStatusCenterActiveState(
        previewId,
        payload.status === "pending" ? "pending" : "processing",
        isPreviewStage(payload.stage) ? payload.stage : null,
      );
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

      if (data.status === "ready") {
        syncStatusCenterTerminalState(previewId, "ready", {
          previewUrl: typeof data.previewUrl === "string" ? data.previewUrl : null,
        });
        closeEventSource();
        return;
      }

      if (data.status === "failed" || hasExplicitFailure(data)) {
        const resolved = resolveErrorFromPayload(data);
        syncStatusCenterTerminalState(
          previewId,
          resolved.code === "preview_expired" ? "expired" : "failed",
          {
            error: resolved.message,
            errorCode: resolved.code,
            errorStage: resolved.stage,
          },
        );
        closeEventSource();
        return;
      }

      if (data.status === "pending" || data.status === "processing") {
        syncStatusCenterActiveState(
          previewId,
          data.status,
          isPreviewStage(data.stage) ? data.stage : null,
        );
      }
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
      retryCount: 0,
    });

    if (typeof window === "undefined" || typeof window.EventSource !== "function") {
      void handleCheckStatus(previewId, statusToken);
      return;
    }

    connectSSE(previewId, statusToken);
  }

  async function handleGenerate() {
    if (!trimmedUrl || disabled) {
      return;
    }

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
          setSubmissionError(resolveErrorMessage(null, reason));
          return;
        }

        const payload = await response.json();
        const previewId = typeof payload?.previewId === "string" ? payload.previewId : null;
        const statusToken = typeof payload?.statusToken === "string" ? payload.statusToken : null;
        const immediatePreview =
          typeof payload?.previewUrl === "string" ? payload.previewUrl : null;

        if (payload?.status === "failed") {
          const resolved = resolveErrorFromPayload(payload);
          if (previewId && statusToken) {
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
            setSubmissionError(resolved.message);
          }
          return;
        }

        if (payload?.status === "ready") {
          if (!previewId || !statusToken) {
            setSubmissionError(t("try.error.default"));
            return;
          }

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
          throw new Error("Preview was created but no ID was returned.");
        }
        if (!statusToken) {
          throw new Error("Preview was created but no status token was returned.");
        }

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
        });
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    } catch (error) {
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
              {progressSteps.map((step, index) => {
                return (
                  <li
                    key={step.id}
                    aria-current={step.state === "current" ? "step" : undefined}
                    className="relative flex items-start gap-3"
                  >
                    <span
                      className={cn(
                        "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background",
                        step.state === "complete" && "border-primary bg-primary text-primary-foreground",
                        step.state === "current" && "border-primary bg-background text-primary shadow-[0_0_0_3px_rgba(124,92,218,0.12)]",
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
                    {t("try.status.processingHint")}
                  </p>
                </div>
              ) : null}

              {showEmailField ? (
                <div className="max-w-sm space-y-3 border-t border-border/65 pt-4">
                  {pendingEmailStatus === "saved" ? (
                    <p className="text-sm font-medium text-foreground">{t("try.pending.emailSaved")}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-foreground">{t("try.pending.emailPrompt")}</p>
                      <Input
                        value={pendingEmail}
                        onChange={(event) => setPendingEmail(event.currentTarget.value)}
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
                  onChange={(event) => setPendingEmail(event.currentTarget.value)}
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
                <Button asChild size="sm" variant="secondary">
                  <a href={trackedJob.previewUrl} target="_blank" rel="noreferrer">
                    {t("try.preview.open")}
                  </a>
                </Button>
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
