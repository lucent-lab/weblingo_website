"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { createAgencyCustomer } from "@internal/dashboard/webhooks";

export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

const failed = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: false,
  message,
  meta,
});

const succeeded = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: true,
  message,
  meta,
});

const emailSchema = z.email();

function formatAgencyBillingMessage(auth: DashboardAuth): string {
  const status = auth.actorAccount?.planStatus ?? "inactive";
  const label = status.replaceAll("_", " ");
  return `Agency billing is ${label}. Update billing to invite customers.`;
}

export async function createAgencyCustomerAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const email = formData.get("email")?.toString().trim() ?? "";
  const customerPlan = formData.get("customerPlan")?.toString().trim() ?? "";

  if (!email || !emailSchema.safeParse(email).success) {
    return failed("Enter a valid customer email.");
  }
  if (customerPlan !== "starter" && customerPlan !== "pro") {
    return failed("Select a customer plan.");
  }

  try {
    const auth = await requireDashboardAuth();
    if (auth.actorAccount?.planType !== "agency") {
      return failed("Agency access is required.");
    }
    if (!auth.actorWebhooksAuth) {
      return failed("Unable to authenticate agency actions.");
    }
    if (!auth.actorPlanActive) {
      return failed(formatAgencyBillingMessage(auth));
    }
    const result = await createAgencyCustomer(auth.actorWebhooksAuth, {
      email,
      customerPlan: customerPlan as "starter" | "pro",
    });
    revalidatePath("/dashboard/agency");
    revalidatePath("/dashboard/agency/customers");
    return succeeded("Customer invited.", {
      inviteLink: result.inviteLink,
      customerAccountId: result.customer.customerAccountId,
    });
  } catch (error) {
    console.error("[dashboard] createAgencyCustomerAction failed:", error);
    return failed("Unable to invite customer.");
  }
}
