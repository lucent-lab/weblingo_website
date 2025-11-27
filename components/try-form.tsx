"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientTranslator, i18nConfig, type ClientMessages, type Locale } from "@internal/i18n";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
};

type PreviewStatus = "idle" | "creating" | "processing" | "ready" | "failed";

export function TryForm({ locale, messages, disabled = false }: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Locale>(i18nConfig.defaultLocale);
  const [targetLang, setTargetLang] = useState<Locale>(locale as Locale);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isDisabled = disabled || status === "creating" || status === "processing";

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
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
  }

  function connectSSE(id: string) {
    closeEventSource();
    setStatus("processing");

    const es = new EventSource(`/api/previews/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data ?? "{}");
        const message = data.message || data.stage || "Processing preview...";
        setProgress(message);
      } catch {
        setProgress("Processing preview...");
      }
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

      const response = await fetch("/api/previews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: trimmed,
          sourceLang,
          targetLang,
        }),
      });

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
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={sourceLang}
            onChange={(event) => setSourceLang(event.target.value as Locale)}
            disabled={isDisabled}
          >
            {i18nConfig.locales.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-2 text-sm">
          <span className="font-medium text-foreground">{t("try.form.targetLabel")}</span>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={targetLang}
            onChange={(event) => setTargetLang(event.target.value as Locale)}
            disabled={isDisabled}
          >
            {i18nConfig.locales.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
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
