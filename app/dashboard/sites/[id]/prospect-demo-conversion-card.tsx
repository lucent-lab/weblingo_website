"use client";

import { useActionState } from "react";
import { ArrowRight, ExternalLink, LockKeyhole, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  convertProspectDemoAction,
  type ProspectDemoConversionActionState,
  type ProspectDemoConversionMessageKey,
} from "./prospect-demo-actions";

export type ProspectDemoConversionCardCopy = {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  pendingLabel: string;
  successTitle: string;
  errorTitle: string;
  openActivationLinkLabel: string;
  messages: Record<ProspectDemoConversionMessageKey, string>;
  nextActions: Record<string, string>;
};

const initialState: ProspectDemoConversionActionState = {
  ok: false,
  messageKey: "unknown",
  message: "",
};

const RESUBMIT_NEXT_ACTIONS = new Set(["complete_payment", "retry_payment", "wait_for_activation"]);

export function ProspectDemoConversionCard({
  copy,
  siteId,
}: {
  copy: ProspectDemoConversionCardCopy;
  siteId: string;
}) {
  const [state, formAction, pending] = useActionState(convertProspectDemoAction, initialState);
  const followUpAction = resolveFollowUpAction({ copy, siteId, state });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg">{copy.title}</CardTitle>
        </div>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="hidden" name="siteId" value={siteId} />
          <Field label={copy.emailLabel} htmlFor="prospect-demo-email" className="min-w-0">
            <Input
              id="prospect-demo-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={copy.emailPlaceholder}
              required
              disabled={pending}
            />
          </Field>
          <Button type="submit" disabled={pending} className="self-end">
            <ArrowRight className="h-4 w-4" />
            {pending ? copy.pendingLabel : copy.submitLabel}
          </Button>
        </form>

        {state.message ? (
          <Alert className={state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : ""}>
            <AlertTitle>{state.ok ? copy.successTitle : copy.errorTitle}</AlertTitle>
            <AlertDescription className={state.ok ? "text-emerald-900" : undefined}>
              {copy.messages[state.messageKey] ?? state.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {followUpAction?.kind === "link" ? (
          <Button asChild variant="outline">
            <a href={followUpAction.href}>
              {followUpAction.external ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {followUpAction.label}
            </a>
          </Button>
        ) : null}
        {followUpAction?.kind === "submit" ? (
          <form action={formAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="email" value={followUpAction.email} />
            <Button type="submit" variant="outline" disabled={pending}>
              <RotateCw className="h-4 w-4" />
              {pending ? copy.pendingLabel : followUpAction.label}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

type FollowUpAction =
  | { kind: "link"; href: string; label: string; external: boolean }
  | { kind: "submit"; email: string; label: string };

function resolveFollowUpAction({
  copy,
  siteId,
  state,
}: {
  copy: ProspectDemoConversionCardCopy;
  siteId: string;
  state: ProspectDemoConversionActionState;
}): FollowUpAction | null {
  const meta = state.ok ? state.meta : null;
  if (!meta) {
    return null;
  }
  if (meta.inviteLink) {
    return {
      kind: "link",
      href: meta.inviteLink,
      label: copy.openActivationLinkLabel,
      external: true,
    };
  }
  if (RESUBMIT_NEXT_ACTIONS.has(meta.nextAction)) {
    return {
      kind: "submit",
      email: meta.email,
      label: copy.nextActions[meta.nextAction] ?? copy.nextActions.default,
    };
  }
  const dashboardPath = `/dashboard/sites/${encodeURIComponent(siteId)}`;
  if (meta.nextAction === "open_dashboard") {
    return {
      kind: "link",
      href: `/auth/login?next=${encodeURIComponent(dashboardPath)}`,
      label: copy.nextActions[meta.nextAction] ?? copy.nextActions.default,
      external: false,
    };
  }
  return {
    kind: "submit",
    email: meta.email,
    label: copy.nextActions[meta.nextAction] ?? copy.nextActions.default,
  };
}
