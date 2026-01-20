"use client";

import { useActionState } from "react";

import { createAgencyCustomerAction, type ActionResponse } from "./actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@internal/dashboard/use-action-toast";

const initialState: ActionResponse = { ok: false, message: "" };

export function CustomerInviteForm() {
  const [state, formAction, pending] = useActionState(createAgencyCustomerAction, initialState);
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Sending invite...",
    success: "Invite sent.",
    error: "Unable to send invite.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a customer</CardTitle>
        <CardDescription>
          Create a managed customer account and send them an invite link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={submitWithToast} className="space-y-3">
          <fieldset
            className="grid gap-3 md:grid-cols-[2fr_1fr_auto]"
            disabled={pending}
            aria-busy={pending}
          >
            <label className="sr-only" htmlFor="customer-email">
              Customer email
            </label>
            <Input
              id="customer-email"
              name="email"
              placeholder="customer@company.com"
              type="email"
              required
            />
            <label className="sr-only" htmlFor="customer-plan">
              Customer plan
            </label>
            <select
              id="customer-plan"
              name="customerPlan"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              defaultValue="starter"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send invite"}
            </Button>
          </fieldset>
        </form>

        {state.message ? (
          <div className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
            {state.message}
            {state.ok && state.meta?.inviteLink ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Invite link:{" "}
                <a
                  className="underline"
                  href={String(state.meta.inviteLink)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {String(state.meta.inviteLink)}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
