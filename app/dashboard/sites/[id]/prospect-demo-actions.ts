"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { readDashboardDemoSession } from "@internal/dashboard/demo-session";
import { invalidateSiteDashboardCache } from "@internal/dashboard/data";
import {
  convertProspectShowcaseDemo,
  WebhooksApiError,
  type ProspectDemoConversionResponse,
} from "@internal/dashboard/webhooks";

export type ProspectDemoConversionMessageKey =
  | "siteRequired"
  | "invalidEmail"
  | "sessionExpired"
  | "siteMismatch"
  | "unexpectedScope"
  | "activationInviteCreated"
  | "demoActivated"
  | "activationPending"
  | "paymentFailed"
  | "checkoutPending"
  | "notFound"
  | "conflict"
  | "timeout"
  | "unavailable"
  | "unknown";

export type ProspectDemoConversionActionState = {
  ok: boolean;
  messageKey: ProspectDemoConversionMessageKey;
  message: string;
  meta?: {
    status: ProspectDemoConversionResponse["status"];
    activationStatus: string;
    locked: boolean;
    lockedReason: string;
    nextAction: string;
    inviteLink?: string;
    email: string;
  };
};

const emailSchema = z.string().email().max(320);

const failed = (
  messageKey: ProspectDemoConversionMessageKey,
  message: string,
): ProspectDemoConversionActionState => ({
  ok: false,
  messageKey,
  message,
});

const succeeded = (
  messageKey: ProspectDemoConversionMessageKey,
  message: string,
  meta: NonNullable<ProspectDemoConversionActionState["meta"]>,
): ProspectDemoConversionActionState => ({
  ok: true,
  messageKey,
  message,
  meta,
});

export async function convertProspectDemoAction(
  _prevState: ProspectDemoConversionActionState | undefined,
  formData: FormData,
): Promise<ProspectDemoConversionActionState> {
  const requestedSiteId = formData.get("siteId")?.toString().trim() ?? "";
  const emailResult = emailSchema.safeParse(formData.get("email")?.toString().trim() ?? "");
  if (!requestedSiteId) {
    return failed("siteRequired", "Site ID is required.");
  }
  if (!emailResult.success) {
    return failed("invalidEmail", "Enter a valid email address.");
  }

  const session = await readDashboardDemoSession();
  if (!session) {
    return failed("sessionExpired", "Demo dashboard access has expired. Open the demo link again.");
  }
  if (session.siteId !== requestedSiteId) {
    return failed("siteMismatch", "This demo session can only activate its claimed site.");
  }

  try {
    const result = await convertProspectShowcaseDemo(
      { token: session.token },
      session.prospectShowcaseRef,
      {
        email: emailResult.data,
        conversionToken: session.conversionToken,
      },
    );
    if (result.siteId !== session.siteId || result.accountId !== session.subjectAccountId) {
      return failed("unexpectedScope", "Demo conversion returned an unexpected account or site.");
    }
    await invalidateSiteDashboardCache(
      {
        token: session.token,
        expiresAt: session.expiresAt,
        subjectAccountId: session.subjectAccountId,
        refresh: async () => session.token,
      },
      session.siteId,
    );
    revalidatePath(`/dashboard/sites/${session.siteId}`);
    return succeeded(formatConversionMessageKey(result), formatConversionMessage(result), {
      status: result.status,
      activationStatus: result.activationStatus,
      locked: result.locked,
      lockedReason: result.lockedReason,
      nextAction: result.nextAction,
      inviteLink: result.inviteLink,
      email: emailResult.data,
    });
  } catch (error) {
    console.error("[dashboard] convertProspectDemoAction failed:", error);
    return toFriendlyProspectDemoConversionError(error);
  }
}

function formatConversionMessageKey(
  result: ProspectDemoConversionResponse,
): ProspectDemoConversionMessageKey {
  if (result.inviteLink) {
    return "activationInviteCreated";
  }
  if (result.status === "converted") {
    return "demoActivated";
  }
  if (result.status === "activation_pending") {
    return "activationPending";
  }
  if (result.status === "payment_failed") {
    return "paymentFailed";
  }
  return "checkoutPending";
}

function formatConversionMessage(result: ProspectDemoConversionResponse): string {
  if (result.inviteLink) {
    return "Activation invite created.";
  }
  if (result.status === "converted") {
    return "Demo activated.";
  }
  if (result.status === "activation_pending") {
    return "Activation is pending.";
  }
  if (result.status === "payment_failed") {
    return "Payment could not be completed.";
  }
  return "Activation checkout is pending.";
}

function toFriendlyProspectDemoConversionError(error: unknown): ProspectDemoConversionActionState {
  if (error instanceof WebhooksApiError) {
    if (error.status === 401 || error.status === 403) {
      return failed(
        "sessionExpired",
        "Demo dashboard access has expired. Open the demo link again.",
      );
    }
    if (error.status === 404) {
      return failed("notFound", "This demo is no longer available.");
    }
    if (error.status === 409) {
      return failed("conflict", error.message || "This demo cannot be activated yet.");
    }
    if (error.status === 504) {
      return failed("timeout", "Activation timed out. Try again in a moment.");
    }
    if (error.status >= 500 || error.status === 0) {
      return failed("unavailable", "Activation is unavailable right now.");
    }
  }
  return failed("unknown", "Unable to activate this demo right now.");
}
