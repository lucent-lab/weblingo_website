"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createSiteShowcaseAction,
  updateSiteShowcaseAction,
  type ActionResponse,
} from "../../../actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import type { SiteShowcaseResponse } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

type SiteShowcaseCardProps = {
  siteId: string;
  sourceUrl: string;
  targetLangs: string[];
  showcaseState: SiteShowcaseResponse | null;
  showcaseMissingConfirmed: boolean;
  fetchError?: string | null;
};

function deriveWebsitePath(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function SiteShowcaseCard({
  siteId,
  sourceUrl,
  targetLangs,
  showcaseState,
  showcaseMissingConfirmed,
  fetchError,
}: SiteShowcaseCardProps) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(
    createSiteShowcaseAction,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateSiteShowcaseAction,
    initialState,
  );
  const suggestedWebsitePath = useMemo(() => deriveWebsitePath(sourceUrl), [sourceUrl]);
  const [websitePath, setWebsitePath] = useState(
    showcaseState?.showcase.websitePath ?? suggestedWebsitePath,
  );
  const [defaultLang, setDefaultLang] = useState(
    showcaseState?.showcase.defaultLang ?? targetLangs[0] ?? "",
  );
  const [status, setStatus] = useState<"active" | "disabled">(
    showcaseState?.showcase.status ?? "active",
  );

  const createWithToast = useActionToast({
    formAction: createAction,
    state: createState,
    pending: createPending,
    loading: "Creating showcase...",
    success: "Showcase created.",
    error: "Unable to create showcase.",
  });

  const updateWithToast = useActionToast({
    formAction: updateAction,
    state: updateState,
    pending: updatePending,
    loading: "Updating showcase...",
    success: "Showcase updated.",
    error: "Unable to update showcase.",
  });

  useEffect(() => {
    if (!createState.ok && !updateState.ok) {
      return;
    }
    router.refresh();
  }, [createState.ok, router, updateState.ok]);

  return (
    <Card className="border-border/60 bg-muted/20">
      <CardHeader>
        <CardTitle>Showcase</CardTitle>
        <CardDescription>
          Public demo access on <span className="font-medium text-foreground">t2.weblingo.app</span>
          . Customer domains still stay blocked until DNS verification is complete.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetchError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {fetchError}
          </div>
        ) : null}

        {showcaseState ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant={showcaseState.showcase.status === "active" ? "secondary" : "outline"}>
                Namespace {showcaseState.showcase.status}
              </Badge>
              <Badge variant="outline">
                Customer serving {showcaseState.customerServingStatus}
              </Badge>
              <Badge variant="outline">
                Showcase serving {showcaseState.showcaseServingStatus}
              </Badge>
            </div>

            <div className="grid gap-3 rounded-xl border border-border/60 bg-background p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Public URL
                </p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {showcaseState.showcase.url ?? "No default language selected"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Website path
                </p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {showcaseState.showcase.websitePath}
                </p>
              </div>
            </div>

            <form action={updateWithToast} className="space-y-4">
              <input name="siteId" type="hidden" value={siteId} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Default language"
                  htmlFor={`showcase-default-lang-${siteId}`}
                  description="Root showcase requests redirect here."
                >
                  <select
                    id={`showcase-default-lang-${siteId}`}
                    name="defaultLang"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    value={defaultLang}
                    onChange={(event) => setDefaultLang(event.target.value)}
                    disabled={updatePending}
                  >
                    {targetLangs.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Namespace status"
                  htmlFor={`showcase-status-${siteId}`}
                  description="Disable the showcase without touching the customer-facing site state."
                >
                  <select
                    id={`showcase-status-${siteId}`}
                    name="status"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as "active" | "disabled")}
                    disabled={updatePending}
                  >
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </Field>
              </div>
              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showcase URLs remain public. SEO is suppressed via noindex and robots blocking.
                </p>
                <div className="flex gap-2">
                  {showcaseState.showcase.url ? (
                    <Button asChild variant="outline">
                      <a href={showcaseState.showcase.url} target="_blank" rel="noreferrer">
                        Open showcase
                      </a>
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={updatePending}>
                    {updatePending ? "Saving..." : "Update showcase"}
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : showcaseMissingConfirmed ? (
          <form action={createWithToast} className="space-y-4">
            <input name="siteId" type="hidden" value={siteId} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Website path"
                htmlFor={`create-showcase-path-${siteId}`}
                description="Public path segment under t2.weblingo.app."
              >
                <Input
                  id={`create-showcase-path-${siteId}`}
                  name="websitePath"
                  value={websitePath}
                  onChange={(event) => setWebsitePath(event.target.value.toLowerCase())}
                  placeholder={suggestedWebsitePath || "autotrim.com"}
                  required
                />
              </Field>
              <Field
                label="Default language"
                htmlFor={`create-showcase-default-lang-${siteId}`}
                description="Used when the showcase root is opened."
              >
                <select
                  id={`create-showcase-default-lang-${siteId}`}
                  name="defaultLang"
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  value={defaultLang}
                  onChange={(event) => setDefaultLang(event.target.value)}
                  disabled={createPending}
                >
                  {targetLangs.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preview URL
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {websitePath && defaultLang
                  ? `https://t2.weblingo.app/${websitePath}/${defaultLang}`
                  : "Choose a website path and default language to preview the showcase URL."}
              </p>
            </div>
            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Use this when a managed demo site exists but does not yet have its showcase
                namespace.
              </p>
              <Button type="submit" disabled={createPending || !websitePath || !defaultLang}>
                {createPending ? "Creating..." : "Create showcase"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Showcase state could not be confirmed. Reload this page before creating or updating the
            namespace.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
