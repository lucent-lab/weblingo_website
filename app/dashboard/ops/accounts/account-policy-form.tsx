"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { updateAdminAccountPolicyAction, type ActionResponse } from "./actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import type { ManagedAccountPolicy } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

type AccountPolicyFormProps = {
  account: ManagedAccountPolicy;
};

function formatNullableInteger(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "";
}

export function AccountPolicyForm({ account }: AccountPolicyFormProps) {
  const [state, formAction, pending] = useActionState(updateAdminAccountPolicyAction, initialState);
  const router = useRouter();
  const featureFlagsJson = useMemo(
    () => JSON.stringify(account.featureFlags ?? {}, null, 2),
    [account.featureFlags],
  );

  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving account policy...",
    success: "Account policy updated.",
    error: "Unable to update the account policy.",
  });

  useEffect(() => {
    if (!state.ok) {
      return;
    }
    router.refresh();
  }, [router, state.ok]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account policy</CardTitle>
        <CardDescription>
          Update plan assignment, managed-demo state, quota overrides, and raw account-level flag
          overrides. The agency plan is intentionally not assignable here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={submitWithToast} className="space-y-6">
          <input name="accountId" type="hidden" value={account.accountId} />

          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Plan"
              htmlFor="account-plan-type"
              description="Free, Starter, and Pro are the only managed-account tiers."
            >
              <select
                id="account-plan-type"
                name="planType"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={account.planType}
                disabled={pending}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
              </select>
            </Field>
            <Field label="Plan status" htmlFor="account-plan-status">
              <select
                id="account-plan-status"
                name="planStatus"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={account.planStatus}
                disabled={pending}
              >
                <option value="active">Active</option>
                <option value="past_due">Past due</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field
              label="Managed demo"
              description="Keeps the account in the internal showcase/demo cohort."
            >
              <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3">
                <input
                  name="managedDemo"
                  type="checkbox"
                  value="true"
                  defaultChecked={account.managedDemo}
                  disabled={pending}
                />
                <span className="text-sm text-foreground">Managed demo enabled</span>
              </label>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Max sites"
              htmlFor="account-max-sites"
              description="Blank clears the override."
            >
              <Input
                id="account-max-sites"
                name="maxSites"
                type="number"
                min="0"
                defaultValue={formatNullableInteger(account.quotas.maxSites)}
                disabled={pending}
              />
            </Field>
            <Field
              label="Free quota"
              htmlFor="account-free-quota"
              description="Blank clears the override."
            >
              <Input
                id="account-free-quota"
                name="freeQuota"
                type="number"
                min="0"
                defaultValue={formatNullableInteger(account.quotas.freeQuota)}
                disabled={pending}
              />
            </Field>
            <Field
              label="Starter quota"
              htmlFor="account-starter-quota"
              description="Blank clears the override."
            >
              <Input
                id="account-starter-quota"
                name="starterQuota"
                type="number"
                min="0"
                defaultValue={formatNullableInteger(account.quotas.starterQuota)}
                disabled={pending}
              />
            </Field>
            <Field
              label="Pro quota"
              htmlFor="account-pro-quota"
              description="Blank clears the override."
            >
              <Input
                id="account-pro-quota"
                name="proQuota"
                type="number"
                min="0"
                defaultValue={formatNullableInteger(account.quotas.proQuota)}
                disabled={pending}
              />
            </Field>
          </div>

          <Field
            label="Feature flag overrides (JSON)"
            htmlFor="account-feature-flags"
            description="Only include keys you want to override at the account level. Leave blank to clear all raw overrides and inherit plan defaults."
          >
            <Textarea
              id="account-feature-flags"
              name="featureFlags"
              className="min-h-64 font-mono text-xs"
              defaultValue={featureFlagsJson}
              disabled={pending}
            />
          </Field>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Plan-derived defaults, account-level overrides, and site-level settings are separate
              scopes. Use each site’s focused settings and developer routes for per-site policy, not
              global account state.
            </p>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save account policy"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
