"use server";

import { revalidatePath } from "next/cache";

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

function formatAgencyBillingMessage(auth: DashboardAuth): string {
  const status = auth.actorAccount?.planStatus ?? "inactive";
  const label = status.replace("_", " ");
  return `Agency billing is ${label}. Update billing to invite customers.`;
}

export async function createAgencyCustomerAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const email = formData.get("email")?.toString().trim() ?? "";
  const customerPlan = formData.get("customerPlan")?.toString().trim() ?? "";

  if (!email || !email.includes("@")) {
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
    if (error instanceof Error) {
      return failed(error.message);
    }
    return failed("Unable to invite customer.");
  }
}
