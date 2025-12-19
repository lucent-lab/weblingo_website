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

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
  supportedLanguages: SupportedLanguage[];
};

type PreviewStatus = "idle" | "creating" | "processing" | "ready" | "failed";

export function TryForm({ locale, messages, disabled = false, supportedLanguages }: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<string>(i18nConfig.defaultLocale);
  const [targetLang, setTargetLang] = useState<string>(locale);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isDisabled = disabled || status === "creating" || status === "processing";

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
      if (data.message || data.stage) {
        setProgress((data.message as string) ?? (data.stage as string));
      }

      if (data.status === "ready" && typeof data.previewUrl === "string") {
        setPreviewUrl(data.previewUrl);
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
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        const preview = data.previewUrl ?? (id ? `/_preview/${id}` : null);
        if (preview) {
          setPreviewUrl(preview);
          setStatus("ready");
        } else {
          setError("Preview completed without a URL.");
          setStatus("failed");
        }
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
    if (!url || disabled) return;
    setStatus("creating");
    setError(null);
    setPreviewUrl(null);
    setProgress(null);
    closeEventSource();

    try {
      const trimmed = url.trim();
      if (!isValidHttpUrl(trimmed)) {
        throw new Error(t("try.form.invalidUrl"));
      }

      const normalizedSourceLang = normalizeLangTag(sourceLang) ?? sourceLang.trim();
      const normalizedTargetLang = normalizeLangTag(targetLang) ?? targetLang.trim();
      if (!normalizedSourceLang || !normalizedTargetLang) {
        throw new Error("Source and target languages are required.");
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/previews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          sourceUrl: trimmed,
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
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
      if (data.message || data.stage) {
        setProgress((data.message as string) ?? (data.stage as string));
      }
      if (data.status === "ready" && typeof data.previewUrl === "string") {
        setPreviewUrl(data.previewUrl);
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
            const data = safeParseJson(event.data) ?? {};
            const preview = (data.previewUrl as string) ?? null;
            if (preview) {
              setPreviewUrl(preview);
              setStatus("ready");
              setProgress(null);
              return;
            }
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
      <div className="flex flex-col gap-4 sm:flex-row">
        <Input
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          placeholder={t("try.form.placeholder")}
          type="url"
          pattern="https?://.*"
          required
          disabled={isDisabled}
        />
        <Button onClick={handleGenerate} disabled={!url || isDisabled}>
          {isDisabled ? `${t("try.form.button")}…` : t("try.form.button")}
        </Button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && status === "failed" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
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
            disabled={isDisabled}
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
            disabled={isDisabled}
            placeholder={locale}
          />
        </label>
      </div>

      {previewUrl && status === "ready" && (
        <div className="rounded-2xl border border-border bg-muted p-6 text-sm text-muted-foreground">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">
            {t("try.preview.ready")}
          </p>
          <p className="mt-2 break-all text-base text-foreground">{previewUrl}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href={previewUrl} target="_blank" rel="noreferrer">
                {t("try.preview.open")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/${locale}/pricing`}>{t("try.preview.subscribe")}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
