"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Avoid SSR for the combobox to prevent Radix Popover ID hydration mismatches.
const LanguageTagCombobox = dynamic(
  () => import("@/components/language-tag-combobox").then((mod) => mod.LanguageTagCombobox),
  { ssr: false },
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientTranslator,
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
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { z } from "zod";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
  supportedLanguages: SupportedLanguage[];
  showEmailField?: boolean;
};

type PreviewStatus = "idle" | "creating" | "pending" | "processing" | "ready" | "failed";

const emailSchema = z.email();
const PREVIEW_STATUSES: PreviewStatus[] = [
  "idle",
  "creating",
  "pending",
  "processing",
  "ready",
  "failed",
];
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

function isPreviewStatus(value: unknown): value is PreviewStatus {
  return typeof value === "string" && PREVIEW_STATUSES.includes(value as PreviewStatus);
}

export function TryForm({
  locale,
  messages,
  disabled = false,
  supportedLanguages,
  showEmailField = false,
}: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<PreviewErrorCode | null>(null);
  const [errorStage, setErrorStage] = useState<PreviewStage | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const baseLocale = getBaseLangTag(locale) ?? locale.trim().toLowerCase();
  const defaultTargetLang = baseLocale === "en" ? "fr" : "en";
  const [sourceLang, setSourceLang] = useState<string>(locale);
  const [targetLang, setTargetLang] = useState<string>(defaultTargetLang);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timedOutWithEmail, setTimedOutWithEmail] = useState(false);
  const [lastPreviewId, setLastPreviewId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStageRef = useRef<PreviewStage | null>(null);
  const timedOutRef = useRef(false);
  const submittedEmailRef = useRef("");

  const trimmedUrl = url.trim();
  const trimmedEmail = email.trim();
  const submittedEmail = submittedEmailRef.current || trimmedEmail;
  const normalizedSourceLang = useMemo(
    () => normalizeLangTag(sourceLang) ?? sourceLang.trim(),
    [sourceLang],
  );
  const normalizedTargetLang = useMemo(
    () => normalizeLangTag(targetLang) ?? targetLang.trim(),
    [targetLang],
  );
  const isPreviewRunning = status === "creating" || status === "pending" || status === "processing";
  const currentRequestKey = useMemo(
    () =>
      buildRequestKey({
        url: trimmedUrl,
        sourceLang,
        targetLang,
        email: trimmedEmail,
      }),
    [trimmedUrl, sourceLang, targetLang, trimmedEmail],
  );
  const isSameRequest = lastRequestKey !== null && currentRequestKey === lastRequestKey;
  const showGeneratingState = isPreviewRunning && isSameRequest;
  const isRequestLocked = isSameRequest && status !== "idle" && status !== "failed";
  const isSameLanguage =
    Boolean(normalizedSourceLang) &&
    Boolean(normalizedTargetLang) &&
    normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase();
  const inputsDisabled = disabled;
  const isGenerateDisabled =
    inputsDisabled ||
    !trimmedUrl ||
    (showEmailField && !trimmedEmail) ||
    isRequestLocked ||
    isSameLanguage;

  useEffect(() => {
    return () => {
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
  }, [previewUrl]);

  function isValidHttpUrl(candidate: string) {
    try {
      const parsed = new URL(candidate.trim());
      if (!parsed.hostname) return false;
      const protocolOk = parsed.protocol === "http:" || parsed.protocol === "https:";
      return protocolOk;
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
    if (!showEmailField) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return t("try.form.emailRequired");
    }
    if (!isValidEmail(trimmed)) {
      return t("try.form.emailInvalid");
    }
    return null;
  }

  function buildRequestKey(input: {
    url: string;
    sourceLang: string;
    targetLang: string;
    email: string;
  }) {
    const normalizedSource = normalizeLangTag(input.sourceLang) ?? input.sourceLang.trim();
    const normalizedTarget = normalizeLangTag(input.targetLang) ?? input.targetLang.trim();
    return [
      input.url.trim(),
      normalizedSource.toLowerCase(),
      normalizedTarget.toLowerCase(),
      input.email.trim().toLowerCase(),
    ].join("|");
  }

  function resolveStageMessage(stage: PreviewStage | null) {
    if (!stage) return null;
    return t(PREVIEW_STAGE_MESSAGE_KEYS[stage]);
  }

  function resolveErrorMessage(code: PreviewErrorCode | null, fallback?: string | null) {
    if (code) {
      return t(PREVIEW_ERROR_MESSAGE_KEYS[code]);
    }
    if (fallback) {
      return fallback;
    }
    return t("try.error.default");
  }

  function applyStageFromPayload(data: Record<string, unknown>) {
    if (isPreviewStage(data.stage)) {
      lastStageRef.current = data.stage;
      setProgress(resolveStageMessage(data.stage));
      return;
    }
    if (data.message || data.stage) {
      setProgress(String(data.message ?? data.stage));
    }
  }

  function applyErrorFromPayload(data: Record<string, unknown>, fallback?: string) {
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
        : lastStageRef.current;
    setErrorCode(code);
    setErrorStage(stage ?? null);
    setError(
      resolveErrorMessage(
        code,
        (data.error as string | undefined) ??
          (data.message as string | undefined) ??
          fallback ??
          null,
      ),
    );
  }

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

  function connectSSE(id: string, streamUrl?: string | null) {
    closeEventSource();
    setStatus("processing");

    const es = new EventSource(streamUrl ?? `/api/previews/${id}/stream`);
    eventSourceRef.current = es;

    let lastEventAt = Date.now();
    const bump = () => {
      lastEventAt = Date.now();
    };

    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt > 45_000) {
        // If we already timed out, don't double-process
        if (timedOutRef.current) {
          closeEventSource();
          return;
        }

        // If email was provided, treat idle as timeout (processing continues)
        if (showEmailField && submittedEmailRef.current) {
          timedOutRef.current = true;
          setTimedOut(true);
          setTimedOutWithEmail(true);
          setLastPreviewId(id);
          setProgress(null);
          closeEventSource();
          return;
        }

        // No email - show "check status" option
        // UI shows t("try.status.timedOutNoEmail") + check status button when timedOut && !timedOutWithEmail
        timedOutRef.current = true;
        setTimedOut(true);
        setTimedOutWithEmail(false);
        setLastPreviewId(id);
        setProgress(null);
        closeEventSource();
      }
    }, 15_000);

    const handlePayload = (data: Record<string, unknown>) => {
      if (typeof data.previewUrl === "string") {
        setPreviewUrl(data.previewUrl);
      }
      applyStageFromPayload(data);

      if (data.status === "ready") {
        setStatus("ready");
        setProgress(null);
        closeEventSource();
        return;
      }

      if (data.status === "failed") {
        applyErrorFromPayload(data);
        setStatus("failed");
        setProgress(null);
        closeEventSource();
        return;
      }

      if (isPreviewStatus(data.status)) {
        setStatus(data.status);
      }
    };

    es.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        bump();
        handlePayload(data);
      } catch {
        setProgress(t("try.status.processing") || "Processing preview...");
      }
    });

    es.addEventListener("status", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        bump();
        handlePayload(data);
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener("message", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        bump();
        handlePayload(data);
      } catch {
        // ignore parse error
      }
    });

    es.addEventListener("heartbeat", () => {
      bump();
    });

    es.addEventListener("complete", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data ?? "{}");
        if (payload && typeof payload.previewUrl === "string") {
          setPreviewUrl(payload.previewUrl);
        }
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse preview response.");
        setStatus("failed");
      } finally {
        setProgress(null);
        closeEventSource();
      }
    });

    es.addEventListener("error", (event) => {
      // If we already timed out, preserve that state - processing continues in queue
      if (timedOutRef.current) {
        closeEventSource();
        return;
      }

      const rawData = event && "data" in event ? (event as MessageEvent).data : undefined;
      if (typeof rawData === "string" && rawData) {
        try {
          const payload = JSON.parse(rawData) as Record<string, unknown>;
          if (hasExplicitFailure(payload)) {
            applyErrorFromPayload(payload, t("try.error.default"));
            setProgress(null);
            setStatus("failed");
            closeEventSource();
            return;
          }
        } catch {
          // fall through to connection loss handling
        }
      }

      const handleDisconnect = async () => {
        setLastPreviewId(id);
        const terminal = await handleCheckStatus(id);
        if (terminal === null) {
          closeEventSource();
          return;
        }
        if (terminal) {
          closeEventSource();
          return;
        }

        // If email was provided, treat connection loss as timeout (processing continues)
        if (showEmailField && submittedEmailRef.current) {
          timedOutRef.current = true;
          setTimedOut(true);
          setTimedOutWithEmail(true);
          setProgress(null);
          closeEventSource();
          return;
        }

        // No email - show "check status" option (not hard failure)
        // UI shows t("try.status.timedOutNoEmail") + check status button when timedOut && !timedOutWithEmail
        timedOutRef.current = true;
        setTimedOut(true);
        setTimedOutWithEmail(false);
        setProgress(null);
        closeEventSource();
      };

      void handleDisconnect();
    });

    es.addEventListener("timeout", () => {
      timedOutRef.current = true;
      closeEventSource();
      setProgress(null);

      if (showEmailField && submittedEmailRef.current) {
        // Processing continues in background; user will get email notification
        setTimedOut(true);
        setTimedOutWithEmail(true);
        setLastPreviewId(id);
        // Keep status as "processing" - don't set to failed
      } else {
        // No email fallback - show timeout with check status option
        setTimedOut(true);
        setTimedOutWithEmail(false);
        setLastPreviewId(id);
        // Keep status as "processing" to allow check status
      }
    });
  }

  async function handleGenerate() {
    if (!trimmedUrl || disabled) return;

    try {
      if (!isValidHttpUrl(trimmedUrl)) {
        const message = t("try.form.invalidUrl");
        setUrlError(message);
        throw new Error(message);
      }
      if (showEmailField) {
        if (!trimmedEmail) {
          const message = t("try.form.emailRequired");
          setEmailError(message);
          throw new Error(message);
        }
        if (!isValidEmail(trimmedEmail)) {
          const message = t("try.form.emailInvalid");
          setEmailError(message);
          throw new Error(message);
        }
      }

      if (!normalizedSourceLang || !normalizedTargetLang) {
        throw new Error("Source and target languages are required.");
      }
      if (normalizedSourceLang.toLowerCase() === normalizedTargetLang.toLowerCase()) {
        throw new Error(t("try.form.sameLanguage"));
      }

      setUrlError(null);
      setEmailError(null);
      const requestKey = buildRequestKey({
        url: trimmedUrl,
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        email: trimmedEmail,
      });

      setStatus("creating");
      setError(null);
      setErrorCode(null);
      setErrorStage(null);
      setProgress(null);
      setPreviewUrl(null);
      setTimedOut(false);
      timedOutRef.current = false;
      submittedEmailRef.current = trimmedEmail;
      setTimedOutWithEmail(false);
      setLastPreviewId(null);
      lastStageRef.current = null;
      closeEventSource();
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
            ...(showEmailField && trimmedEmail ? { email: trimmedEmail } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const reason =
            payload?.error || payload?.message || `Request failed with status ${response.status}`;
          applyErrorFromPayload(payload ?? {}, reason);
          setStatus("failed");
          return;
        }

        const payload = await response.json();
        const id = payload?.previewId as string | undefined;
        const streamUrl =
          typeof payload?.streamUrl === "string" ? (payload.streamUrl as string) : null;
        const immediatePreview = payload?.previewUrl as string | undefined;

        applyStageFromPayload(payload ?? {});

        if (payload?.status === "failed") {
          applyErrorFromPayload(payload);
          setStatus("failed");
          return;
        }

        if (payload?.status === "ready" && immediatePreview) {
          setPreviewUrl(immediatePreview);
          setStatus("ready");
          return;
        }

        if (!id) {
          throw new Error("Preview was created but no ID was returned.");
        }

        connectSSE(id, streamUrl);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate preview.";
      setError(message);
      setStatus("failed");
    }
  }

  async function handleCopyPreview() {
    if (!previewUrl) return;
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

  async function handleCheckStatus(previewId?: string): Promise<boolean | null> {
    const id = previewId ?? lastPreviewId;
    if (!id || checkingStatus) return null;
    if (previewId) {
      setLastPreviewId(previewId);
    }

    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/previews/${id}`);
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
          setProgress(t("try.status.stillProcessing"));
          return false;
        }
        const reason =
          (payload && typeof payload.error === "string" ? payload.error : "") ||
          (payload && typeof payload.message === "string" ? payload.message : "") ||
          t("try.error.default");
        applyErrorFromPayload(payload ?? {}, reason);
        setStatus("failed");
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      }
      if (!payload || typeof payload !== "object") {
        setProgress(t("try.status.stillProcessing"));
        return false;
      }
      const data = payload as Record<string, unknown>;

      if (data.status === "ready") {
        if (typeof data.previewUrl === "string") {
          setPreviewUrl(data.previewUrl);
        }
        setStatus("ready");
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      } else if (data.status === "failed") {
        applyErrorFromPayload(data, t("try.error.default"));
        setStatus("failed");
        setTimedOut(false);
        setTimedOutWithEmail(false);
        return true;
      } else {
        // Still processing - update progress text
        const stage = isPreviewStage(data.stage) ? data.stage : null;
        const stageMessage = stage ? resolveStageMessage(stage) : null;
        setProgress(stageMessage || t("try.status.stillProcessing"));
        return false;
      }
    } catch {
      setProgress(t("try.status.stillProcessing"));
      return false;
    } finally {
      setCheckingStatus(false);
    }
  }

  const statusMessage = useMemo(() => {
    switch (status) {
      case "creating":
        return t("try.status.creating") || "Creating preview...";
      case "pending":
        return t("try.status.pending") || "Queued... starting soon.";
      case "processing":
        return progress || t("try.status.processing") || "Translating your page...";
      default:
        return null;
    }
  }, [status, progress, t]);
  const resolvedError = errorCode ? t(PREVIEW_ERROR_MESSAGE_KEYS[errorCode]) : error;
  const errorStageMessage = resolveStageMessage(errorStage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
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
          <Button onClick={handleGenerate} disabled={isGenerateDisabled}>
            {showGeneratingState ? `${t("try.form.button")}…` : t("try.form.button")}
          </Button>
        </div>
        {showEmailField ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t("try.form.emailLabel")}</span>
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
              aria-label={t("try.form.emailLabel")}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              disabled={inputsDisabled}
              aria-invalid={emailError ? "true" : "false"}
            />
            <div className="text-xs text-muted-foreground">{t("try.form.emailHelper")}</div>
            {emailError ? <div className="text-sm text-destructive">{emailError}</div> : null}
          </div>
        ) : null}
      </div>

      {statusMessage && !timedOut && (
        <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="flex flex-col gap-1">
            <span>{statusMessage}</span>
            {isPreviewRunning ? (
              <span className="text-xs text-primary/80">{t("try.status.processingHint")}</span>
            ) : null}
          </div>
        </div>
      )}

      {timedOut && timedOutWithEmail && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <p>{t("try.status.pendingEmail", undefined, { email: submittedEmail })}</p>
          <p className="mt-1 text-xs opacity-80">{t("try.status.pendingEmailHint")}</p>
        </div>
      )}

      {timedOut && !timedOutWithEmail && (
        <div className="flex flex-col gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <p>{t("try.status.timedOutNoEmail")}</p>
          <Button
            onClick={() => handleCheckStatus()}
            disabled={checkingStatus}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            {checkingStatus ? t("try.action.checkingStatus") : t("try.action.checkStatus")}
          </Button>
        </div>
      )}

      {resolvedError && status === "failed" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div>{resolvedError}</div>
          {errorStageMessage ? (
            <div className="text-xs text-destructive/80">
              {t("try.error.stageLabel", undefined, { stage: errorStageMessage })}
            </div>
          ) : null}
        </div>
      )}

      {status === "ready" && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t("try.status.ready")}</span>
              {previewUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    {t("try.preview.open")}
                  </a>
                </Button>
              ) : null}
            </div>
            {previewUrl ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-primary/80">
                  {t("try.preview.linkLabel")}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={previewUrl}
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
      )}

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
      {isSameLanguage && (
        <div className="text-sm text-destructive">{t("try.form.sameLanguage")}</div>
      )}
    </div>
  );
}
