"use client";

import { useActionState } from "react";

import { createAgencyCustomerAction, type ActionResponse } from "./actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ActionResponse = { ok: false, message: "" };

export function CustomerInviteForm() {
  const [state, formAction] = useActionState(createAgencyCustomerAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a customer</CardTitle>
        <CardDescription>
          Create a managed customer account and send them an invite link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
          <Input name="email" placeholder="customer@company.com" type="email" required />
          <select
            name="customerPlan"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            defaultValue="starter"
          >
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
          </select>
          <Button type="submit">Send invite</Button>
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
