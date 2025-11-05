"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientTranslator, type ClientMessages } from "@internal/i18n";

type TryFormProps = {
  locale: string;
  messages: ClientMessages;
};

export function TryForm({ locale, messages }: TryFormProps) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function handleGenerate() {
    if (!url) return;
    setStatus("loading");
    try {
      const encoded = encodeURIComponent(url.trim());
      setPreviewUrl(`/preview?src=${encoded}`);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Input
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          placeholder={t("try.form.placeholder")}
          type="url"
          required
        />
        <Button onClick={handleGenerate} disabled={!url || status === "loading"}>
          {status === "loading" ? `${t("try.form.button")}…` : t("try.form.button")}
        </Button>
      </div>
      {previewUrl ? (
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
      ) : null}
    </div>
  );
}
