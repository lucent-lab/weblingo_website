"use client";

import { useActionState } from "react";
import { ArrowRight, ExternalLink, LockKeyhole } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  convertProspectDemoAction,
  type ProspectDemoConversionActionState,
} from "./prospect-demo-actions";

const initialState: ProspectDemoConversionActionState = { ok: false, message: "" };

export function ProspectDemoConversionCard({ siteId }: { siteId: string }) {
  const [state, formAction, pending] = useActionState(convertProspectDemoAction, initialState);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg">Activate this demo</CardTitle>
        </div>
        <CardDescription>
          Create the locked starter account and receive the activation invite for your domain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="hidden" name="siteId" value={siteId} />
          <Field label="Work email" htmlFor="prospect-demo-email" className="min-w-0">
            <Input
              id="prospect-demo-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="owner@example.com"
              required
              disabled={pending}
            />
          </Field>
          <Button type="submit" disabled={pending} className="self-end">
            <ArrowRight className="h-4 w-4" />
            {pending ? "Activating..." : "Continue"}
          </Button>
        </form>

        {state.message ? (
          <Alert className={state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : ""}>
            <AlertTitle>{state.ok ? "Activation started" : "Activation unavailable"}</AlertTitle>
            <AlertDescription className={state.ok ? "text-emerald-900" : undefined}>
              {state.message}
            </AlertDescription>
          </Alert>
        ) : null}

        {state.ok && state.meta?.inviteLink ? (
          <Button asChild variant="outline">
            <a href={state.meta.inviteLink}>
              <ExternalLink className="h-4 w-4" />
              Open activation link
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
