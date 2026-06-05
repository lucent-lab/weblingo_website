"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { readDashboardDemoSession } from "@internal/dashboard/demo-session";
import {
  convertProspectShowcaseDemo,
  WebhooksApiError,
  type ProspectDemoConversionResponse,
} from "@internal/dashboard/webhooks";

export type ProspectDemoConversionActionState = {
  ok: boolean;
  message: string;
  meta?: {
    status: ProspectDemoConversionResponse["status"];
    activationStatus: string;
    locked: boolean;
    lockedReason: string;
    nextAction: string;
    inviteLink?: string;
  };
};

const emailSchema = z.string().email().max(320);

const failed = (message: string): ProspectDemoConversionActionState => ({
  ok: false,
  message,
});

const succeeded = (
  message: string,
  meta: NonNullable<ProspectDemoConversionActionState["meta"]>,
): ProspectDemoConversionActionState => ({
  ok: true,
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
    return failed("Site ID is required.");
  }
  if (!emailResult.success) {
    return failed("Enter a valid email address.");
  }

  const session = await readDashboardDemoSession();
  if (!session) {
    return failed("Demo dashboard access has expired. Open the demo link again.");
  }
  if (session.siteId !== requestedSiteId) {
    return failed("This demo session can only activate its claimed site.");
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
      return failed("Demo conversion returned an unexpected account or site.");
    }
    revalidatePath(`/dashboard/sites/${session.siteId}`);
    return succeeded(formatConversionMessage(result), {
      status: result.status,
      activationStatus: result.activationStatus,
      locked: result.locked,
      lockedReason: result.lockedReason,
      nextAction: result.nextAction,
      inviteLink: result.inviteLink,
    });
  } catch (error) {
    console.error("[dashboard] convertProspectDemoAction failed:", error);
    return failed(toFriendlyProspectDemoConversionError(error));
  }
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

function toFriendlyProspectDemoConversionError(error: unknown): string {
  if (error instanceof WebhooksApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Demo dashboard access has expired. Open the demo link again.";
    }
    if (error.status === 404) {
      return "This demo is no longer available.";
    }
    if (error.status === 409) {
      return error.message || "This demo cannot be activated yet.";
    }
    if (error.status === 504) {
      return "Activation timed out. Try again in a moment.";
    }
    if (error.status >= 500 || error.status === 0) {
      return "Activation is unavailable right now.";
    }
  }
  return "Unable to activate this demo right now.";
}
