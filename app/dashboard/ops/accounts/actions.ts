"use server";

import { revalidatePath } from "next/cache";

import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import {
  updateAdminAccount,
  type ManagedAccountFeatureFlagOverrides,
  type ManagedAccountPlan,
} from "@internal/dashboard/webhooks";

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

function parseManagedAccountPlan(value: string): ManagedAccountPlan | null {
  if (value === "free" || value === "starter" || value === "pro") {
    return value;
  }
  return null;
}

function parsePlanStatus(value: string): "active" | "past_due" | "cancelled" | null {
  if (value === "active" || value === "past_due" || value === "cancelled") {
    return value;
  }
  return null;
}

function parseNullableInteger(value: string, field: string): number | null | string {
  if (!value.trim()) {
    return null;
  }
  if (!/^\d+$/.test(value.trim())) {
    return `${field} must be a non-negative integer or blank.`;
  }
  return Number.parseInt(value.trim(), 10);
}

function parseFeatureFlags(rawValue: string): ManagedAccountFeatureFlagOverrides | null | string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Feature flag overrides must be a JSON object.";
    }
    return parsed as ManagedAccountFeatureFlagOverrides;
  } catch {
    return "Feature flag overrides must be valid JSON.";
  }
}

function getInternalAdminAuth() {
  return requireDashboardAuth().then((auth) => {
    if (!hasActorInternalOps(auth)) {
      throw new Error("Internal admin access is required.");
    }
    const actorAuth = auth.actorWebhooksAuth ?? auth.webhooksAuth;
    if (!actorAuth) {
      throw new Error("Unable to authenticate internal admin actions.");
    }
    return actorAuth;
  });
}

export async function updateAdminAccountPolicyAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const accountId = formData.get("accountId")?.toString().trim() ?? "";
  const planTypeRaw = formData.get("planType")?.toString().trim() ?? "";
  const planStatusRaw = formData.get("planStatus")?.toString().trim() ?? "";
  const managedDemo = formData.get("managedDemo")?.toString() === "true";
  const featureFlagsRaw = formData.get("featureFlags")?.toString() ?? "";

  if (!accountId) {
    return failed("Account ID is required.");
  }
  const planType = parseManagedAccountPlan(planTypeRaw);
  if (!planType) {
    return failed("Managed accounts can only use Free, Starter, or Pro.");
  }
  const planStatus = parsePlanStatus(planStatusRaw);
  if (!planStatus) {
    return failed("Plan status must be active, past_due, or cancelled.");
  }

  const maxSites = parseNullableInteger(formData.get("maxSites")?.toString() ?? "", "Max sites");
  if (typeof maxSites === "string") {
    return failed(maxSites);
  }
  const freeQuota = parseNullableInteger(formData.get("freeQuota")?.toString() ?? "", "Free quota");
  if (typeof freeQuota === "string") {
    return failed(freeQuota);
  }
  const starterQuota = parseNullableInteger(
    formData.get("starterQuota")?.toString() ?? "",
    "Starter quota",
  );
  if (typeof starterQuota === "string") {
    return failed(starterQuota);
  }
  const proQuota = parseNullableInteger(formData.get("proQuota")?.toString() ?? "", "Pro quota");
  if (typeof proQuota === "string") {
    return failed(proQuota);
  }

  const featureFlags = parseFeatureFlags(featureFlagsRaw);
  if (typeof featureFlags === "string") {
    return failed(featureFlags);
  }

  try {
    const auth = await getInternalAdminAuth();
    await updateAdminAccount(auth, accountId, {
      planType,
      planStatus,
      managedDemo,
      maxSites,
      freeQuota,
      starterQuota,
      proQuota,
      featureFlags,
    });
    revalidatePath("/dashboard/ops");
    revalidatePath("/dashboard/ops/accounts");
    revalidatePath(`/dashboard/ops/accounts/${accountId}`);
    revalidatePath("/dashboard/ops/showcases");
    revalidatePath("/dashboard/agency/customers");
    return succeeded("Account policy updated.");
  } catch (error) {
    console.error("[dashboard] updateAdminAccountPolicyAction failed:", error);
    return failed("Unable to update the account policy.");
  }
}
