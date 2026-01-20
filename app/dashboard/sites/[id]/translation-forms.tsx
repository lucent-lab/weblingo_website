"use client";

import { useActionState } from "react";

import { createOverrideAction, updateSlugAction, type ActionResponse } from "../../actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@internal/dashboard/use-action-toast";

const initialState: ActionResponse = { ok: false, message: "" };

export function OverrideForm({ siteId }: { siteId: string }) {
  const [state, formAction, pending] = useActionState(createOverrideAction, initialState);
  const messageId = "override-status";
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving override...",
    success: "Override saved.",
    error: "Unable to save override.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual override</CardTitle>
        <CardDescription>Submit a precise translation for a segment.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitWithToast} className="space-y-3" aria-busy={pending}>
          <input name="siteId" type="hidden" value={siteId} />
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="segmentId">
              Segment ID
            </label>
            <Input
              id="segmentId"
              name="segmentId"
              placeholder="seg_123"
              required
              aria-describedby={state.message ? messageId : undefined}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="targetLang">
                Target language
              </label>
              <Input
                id="targetLang"
                name="targetLang"
                placeholder="fr"
                required
                aria-describedby={state.message ? messageId : undefined}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="text">
                Translated text
              </label>
              <Textarea
                id="text"
                name="text"
                placeholder="Votre contenu..."
                required
                aria-describedby={state.message ? messageId : undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="contextHashScope">
              Context hash scope (optional)
            </label>
            <Input
              id="contextHashScope"
              name="contextHashScope"
              placeholder="Use only when advised for ambiguous segments"
            />
          </div>
          {state.message && !state.ok ? (
            <p className="text-sm text-destructive" id={messageId} role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save override"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SlugForm({ siteId }: { siteId: string }) {
  const [state, formAction, pending] = useActionState(updateSlugAction, initialState);
  const messageId = "slug-status";
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving slug...",
    success: "Slug saved.",
    error: "Unable to save slug.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Localized slug</CardTitle>
        <CardDescription>Normalize and publish a path for a translated page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitWithToast} className="space-y-3" aria-busy={pending}>
          <input name="siteId" type="hidden" value={siteId} />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="pageId">
                Page ID
              </label>
              <Input
                aria-describedby={state.message ? messageId : undefined}
                id="pageId"
                name="pageId"
                placeholder="page_123"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="lang">
                Language
              </label>
              <Input
                aria-describedby={state.message ? messageId : undefined}
                id="lang"
                name="lang"
                placeholder="fr"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="path">
                Path
              </label>
              <Input
                aria-describedby={state.message ? messageId : undefined}
                id="path"
                name="path"
                placeholder="/fr/produits"
                required
              />
            </div>
          </div>
          {state.message && !state.ok ? (
            <p className="text-sm text-destructive" id={messageId} role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save slug"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
