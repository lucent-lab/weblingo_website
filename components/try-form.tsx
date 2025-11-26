"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClientTranslator,
  i18nConfig,
  type ClientMessages,
  type Locale,
} from "@internal/i18n";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
  disabled?: boolean;
};

type PreviewStatus = "idle" | "creating" | "pending" | "processing" | "ready" | "failed";

interface StoredPreview {
  previewId: string;
  sourceUrl: string;
  targetLang: string;
  createdAt: number;
}

const STORAGE_KEY = "weblingo_pending_previews";
const MAX_STORED_PREVIEWS = 5;
const PREVIEW_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function getStoredPreviews(): StoredPreview[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as StoredPreview[];
    const now = Date.now();
    return parsed.filter((p) => now - p.createdAt < PREVIEW_EXPIRY_MS);
  } catch {
    return [];
  }
}

function storePreview(preview: StoredPreview): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredPreviews();
    const filtered = existing.filter((p) => p.previewId !== preview.previewId);
    const updated = [preview, ...filtered].slice(0, MAX_STORED_PREVIEWS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

function removeStoredPreview(previewId: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredPreviews();
    const updated = existing.filter((p) => p.previewId !== previewId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function TryForm({ locale, messages, disabled = false }: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<Locale>(i18nConfig.defaultLocale);
  const [targetLang, setTargetLang] = useState<Locale>(locale as Locale);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isDisabled = disabled || status === "creating" || status === "pending" || status === "processing";

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

  const connectSSE = useCallback((id: string) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/previews/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("status", (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(data.status as PreviewStatus);

        if (data.status === "ready" && data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          removeStoredPreview(id);
          eventSource.close();
        } else if (data.status === "failed") {
          setError(data.error || "Translation failed");
          removeStoredPreview(id);
          eventSource.close();
        }
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("error", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        setError(data.error || "Connection error");
        setStatus("failed");
        removeStoredPreview(id);
      } catch {
        // SSE connection error (not a parsed event)
        setError("Connection lost. Retrying...");
        // Don't remove from storage - might reconnect
      }
      eventSource.close();
    });

    eventSource.addEventListener("timeout", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        setError(data.error || "Translation timed out");
        setStatus("failed");
        removeStoredPreview(id);
      } catch {
        setError("Translation timed out");
        setStatus("failed");
      }
      eventSource.close();
    });

    eventSource.onerror = () => {
      // Generic error - attempt to poll status instead
      eventSource.close();
      pollStatus(id);
    };
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/previews/${id}`);
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      const data = await response.json();

      if (data.status === "ready" && data.previewUrl) {
        setStatus("ready");
        setPreviewUrl(data.previewUrl);
        removeStoredPreview(id);
      } else if (data.status === "failed") {
        setStatus("failed");
        setError(data.error || "Translation failed");
        removeStoredPreview(id);
      } else {
        // Still processing - try SSE again or continue polling
        setStatus(data.status as PreviewStatus);
        setTimeout(() => pollStatus(id), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check status");
      setStatus("failed");
    }
  }, []);

  // Check localStorage on mount for any pending previews
  useEffect(() => {
    const stored = getStoredPreviews();
    if (stored.length > 0) {
      const latest = stored[0];
      setPreviewId(latest.previewId);
      setUrl(latest.sourceUrl);
      setStatus("processing");
      connectSSE(latest.previewId);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connectSSE]);

  async function handleGenerate() {
    if (!url || disabled) return;
    setStatus("creating");
    setError(null);
    setPreviewUrl(null);
    setPreviewId(null);

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
      const id = payload?.previewId;

      if (!id) {
        throw new Error("Preview was created but no ID was returned.");
      }

      setPreviewId(id);
      setStatus(payload.status as PreviewStatus);

      // Store in localStorage for persistence across navigation
      storePreview({
        previewId: id,
        sourceUrl: trimmed,
        targetLang,
        createdAt: Date.now(),
      });

      // If already ready (unlikely but possible), show immediately
      if (payload.status === "ready" && payload.previewUrl) {
        setPreviewUrl(payload.previewUrl);
        setStatus("ready");
        removeStoredPreview(id);
        return;
      }

      // Connect to SSE stream for real-time updates
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
      case "pending":
        return t("try.status.pending") || "Queued for translation...";
      case "processing":
        return t("try.status.processing") || "Translating your page...";
      default:
        return null;
    }
  }, [status, t]);

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

      {/* Processing status */}
      {statusMessage && (
        <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Error display */}
      {error && status === "failed" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Language selectors */}
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

      {/* Ready state with preview link */}
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

