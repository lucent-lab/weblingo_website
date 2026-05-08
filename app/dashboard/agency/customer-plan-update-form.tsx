"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { updateAgencyCustomerPlanAction, type ActionResponse } from "./actions";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import type { AgencyCustomer } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

type CustomerPlanUpdateFormProps = {
  customerAccountId: string;
  currentPlan: AgencyCustomer["customerPlan"];
};

export function CustomerPlanUpdateForm({
  customerAccountId,
  currentPlan,
}: CustomerPlanUpdateFormProps) {
  const [state, formAction, pending] = useActionState(updateAgencyCustomerPlanAction, initialState);
  const router = useRouter();
  const wasPending = useRef(false);
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Updating customer plan...",
    success: "Customer plan updated.",
    error: "Unable to update the customer plan.",
  });
  const editableDefault = currentPlan === "pro" ? "pro" : "starter";

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.ok]);

  return (
    <form action={submitWithToast} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input name="customerAccountId" type="hidden" value={customerAccountId} />
      <select
        name="customerPlan"
        aria-label="Customer plan"
        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        defaultValue={currentPlan === "free" ? editableDefault : currentPlan}
        disabled={pending}
      >
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Update plan"}
      </Button>
    </form>
  );
}
