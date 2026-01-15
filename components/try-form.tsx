"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientTranslator,
  i18nConfig,
  normalizeLangTag,
  type ClientMessages,
} from "@internal/i18n";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { z } from "zod";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
  supportedLanguages: SupportedLanguage[];
  showEmailField?: boolean;
};

type PreviewStatus = "idle" | "creating" | "processing" | "ready" | "failed";

const emailSchema = z.email();

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
  const [urlError, setUrlError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<string>(i18nConfig.defaultLocale);
  const [targetLang, setTargetLang] = useState<string>(locale);
  const [lastRequestKey, setLastRequestKey] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const isPreviewRunning = status === "creating" || status === "processing";
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
    };
  }, []);

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

  function connectSSE(id: string) {
    closeEventSource();
    setStatus("processing");

    const es = new EventSource(`/api/previews/${id}/stream`);
    eventSourceRef.current = es;

    let lastEventAt = Date.now();
    const bump = () => {
      lastEventAt = Date.now();
    };

    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastEventAt > 45_000) {
        setError("Connection lost, please try again.");
        setStatus("failed");
        closeEventSource();
      }
    }, 15_000);

    const handlePayload = (data: Record<string, unknown>) => {
      if (typeof data.previewUrl === "string") {
        setPreviewUrl(data.previewUrl);
      }
      if (data.message || data.stage) {
        setProgress((data.message as string) ?? (data.stage as string));
      }

      if (data.status === "ready") {
        setStatus("ready");
        setProgress(null);
        closeEventSource();
        return;
      }

      if (data.status === "failed") {
        setError((data.error as string) || "Preview failed.");
        setStatus("failed");
        setProgress(null);
        closeEventSource();
        return;
      }

      if (typeof data.status === "string") {
        setStatus(data.status as PreviewStatus);
      }
    };

    es.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        const message = data.message || data.stage || "Processing preview...";
        setProgress(message);
        bump();
        handlePayload(data);
      } catch {
        setProgress("Processing preview...");
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
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        setError(data.error || data.message || "Preview failed.");
      } catch {
        setError("Preview failed.");
      } finally {
        setProgress(null);
        setStatus("failed");
        closeEventSource();
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
      setProgress(null);
      setPreviewUrl(null);
      closeEventSource();
      setLastRequestKey(requestKey);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/previews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          sourceUrl: trimmedUrl,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          ...(showEmailField && trimmedEmail ? { email: trimmedEmail } : {}),
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        await consumeEventStream(response);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const reason =
          payload?.error || payload?.message || `Request failed with status ${response.status}`;
        throw new Error(reason);
      }

      const payload = await response.json();
      const id = payload?.previewId as string | undefined;
      const immediatePreview = payload?.previewUrl as string | undefined;

      if (immediatePreview) {
        setPreviewUrl(immediatePreview);
        setStatus("ready");
        return;
      }

      if (!id) {
        throw new Error("Preview was created but no ID was returned.");
      }

      connectSSE(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate preview.";
      setError(message);
      setStatus("failed");
    }
  }

  async function consumeEventStream(response: Response) {
    if (!response.body) {
      throw new Error("Stream response missing body");
    }

    setStatus("processing");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handlePayload = (data: Record<string, unknown>) => {
      if (typeof data.previewUrl === "string") {
        setPreviewUrl(data.previewUrl);
      }
      if (data.message || data.stage) {
        setProgress((data.message as string) ?? (data.stage as string));
      }
      if (data.status === "ready") {
        setStatus("ready");
        setProgress(null);
        return true;
      }
      if (data.status === "failed") {
        setError((data.error as string) || "Preview failed.");
        setStatus("failed");
        setProgress(null);
        return true;
      }
      return false;
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex;
        while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const event = parseSseEvent(rawEvent);
          if (!event) continue;

          if (event.type === "progress" || event.type === "status" || event.type === "message") {
            const data = safeParseJson(event.data);
            if (data) {
              const doneHandled = handlePayload(data);
              if (doneHandled) return;
            }
          }

          if (event.type === "complete") {
            const data = safeParseJson(event.data);
            if (data && typeof data.previewUrl === "string") {
              setPreviewUrl(data.previewUrl);
            }
            setStatus("ready");
            setProgress(null);
            return;
          }

          if (event.type === "error") {
            const data = safeParseJson(event.data) ?? {};
            setError((data.error as string) || "Preview failed.");
            setStatus("failed");
            setProgress(null);
            return;
          }
        }
      }
    } finally {
      abortControllerRef.current = null;
    }

    // If stream ends without terminal event
    setError("Preview stream ended unexpectedly.");
    setStatus("failed");
  }

  function parseSseEvent(raw: string): { type: string; data: string } | null {
    const lines = raw.split("\n");
    let type = "message";
    const data: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        type = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trim());
      }
    }
    if (!data.length) return null;
    return { type, data: data.join("\n") };
  }

  function safeParseJson(input: string): Record<string, unknown> | null {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  const statusMessage = useMemo(() => {
    switch (status) {
      case "creating":
        return t("try.status.creating") || "Creating preview...";
      case "processing":
        return progress || t("try.status.processing") || "Translating your page...";
      default:
        return null;
    }
  }, [status, progress, t]);

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

      {statusMessage && (
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

      {error && status === "failed" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {status === "ready" && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
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
