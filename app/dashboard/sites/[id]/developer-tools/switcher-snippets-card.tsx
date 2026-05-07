"use client";

import { Code2, Loader2 } from "lucide-react";
import { useState } from "react";

import type { ActionResponse } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LanguageSwitcherSnippet } from "@internal/dashboard/webhooks";

type SwitcherSnippetsCardProps = {
  siteId: string;
  available: boolean;
  action: (prevState: ActionResponse | undefined, formData: FormData) => Promise<ActionResponse>;
};

export function SwitcherSnippetsCard({ siteId, available, action }: SwitcherSnippetsCardProps) {
  const [path, setPath] = useState("/");
  const [currentLang, setCurrentLang] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const snippets = result?.ok ? readSnippets(result.meta) : [];

  const loadSnippets = () => {
    if (!available || isLoading) {
      return;
    }
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.set("siteId", siteId);
    formData.set("path", path.trim() || "/");
    const normalizedCurrentLang = currentLang.trim();
    if (normalizedCurrentLang) {
      formData.set("currentLang", normalizedCurrentLang);
    }
    void action(undefined, formData)
      .then(setResult)
      .catch((error) => {
        setResult({
          ok: false,
          message: error instanceof Error ? error.message : "Unable to fetch switcher snippets.",
        });
      })
      .finally(() => setLoading(false));
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Snippets</CardTitle>
          <CardDescription>Load snippet details only when you need them.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
          <Field label="Path" htmlFor="switcher-snippet-path">
            <Input
              id="switcher-snippet-path"
              value={path}
              disabled={!available || isLoading}
              onChange={(event) => setPath(event.target.value)}
            />
          </Field>
          <Field label="Current locale" htmlFor="switcher-snippet-current-lang">
            <Input
              id="switcher-snippet-current-lang"
              value={currentLang}
              disabled={!available || isLoading}
              onChange={(event) => setCurrentLang(event.target.value)}
              placeholder="fr"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={!available || isLoading}
            onClick={loadSnippets}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Code2 className="h-4 w-4" />
            )}
            {isLoading ? "Loading" : "Load snippets"}
          </Button>
        </div>

        {!available ? (
          <p className="text-sm text-muted-foreground">
            Enable the language switcher in settings before loading snippets.
          </p>
        ) : null}

        {result ? (
          <p
            role={result.ok ? "status" : "alert"}
            className={cn("text-sm", result.ok ? "text-emerald-700" : "text-destructive")}
          >
            {result.message}
          </p>
        ) : null}

        {snippets.length ? (
          <div className="space-y-3">
            {snippets.map((snippet, index) => (
              <div
                className="rounded-md border border-border/60 bg-muted/20 p-3"
                key={`${snippet.templateId}:${index}`}
              >
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  {snippet.templateId}
                </p>
                <pre className="max-h-72 overflow-auto rounded-md bg-background p-3 text-xs">
                  <code>{snippet.html}</code>
                </pre>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function readSnippets(meta: Record<string, unknown> | undefined): LanguageSwitcherSnippet[] {
  const value = meta?.snippets;
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isLanguageSwitcherSnippet);
}

function isLanguageSwitcherSnippet(value: unknown): value is LanguageSwitcherSnippet {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.templateId === "string" && typeof record.html === "string";
}
