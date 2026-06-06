"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/app/dashboard/actions";
import { invalidateDashboardBootstrapCache } from "@/internal/dashboard/auth";
import { ANALYTICS_EVENTS } from "@internal/analytics/events";
import { captureServerAnalyticsEvent } from "@internal/analytics/server";
import { envServer } from "@internal/core/env-server";
import { FetchTimeoutError, fetchWithTimeout } from "@internal/core/fetch-timeout";

const failed = (message: string): ActionResponse => ({
  ok: false,
  message,
});

const succeeded = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: true,
  message,
  meta,
});

export async function claimAccount(
  _prevState: ActionResponse | undefined,
  _formData: FormData,
): Promise<ActionResponse> {
  void _prevState;
  void _formData;
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    redirect("/");
  }
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/auth/login");
  }
  captureServerAnalyticsEvent(
    ANALYTICS_EVENTS.accountClaimStarted,
    {
      feature: "account_claim",
      outcome: "started",
      app_surface: "dashboard",
    },
    { distinctId: session.user.id },
  );

  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const apiTimeoutMs = Number(envServer.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS);
  if (!Number.isFinite(apiTimeoutMs) || apiTimeoutMs < 1) {
    throw new Error("[config] NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS must be a positive integer");
  }

  let shouldRedirectToDashboard = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetchWithTimeout(
      `${apiBase}/accounts/claim`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
      { timeoutMs: apiTimeoutMs },
    );

    if (response.ok || response.status === 409) {
      // 200 = created/linked, 409 = already exists; both can proceed to dashboard.
      shouldRedirectToDashboard = true;
    } else if (response.status === 401 || response.status === 403) {
      errorMessage = "Your session cannot claim dashboard access.";
    } else if (response.status >= 500) {
      errorMessage = "The dashboard service is unavailable right now.";
    } else {
      errorMessage = "Unable to claim dashboard access.";
    }
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      errorMessage = "The request timed out. Please retry.";
    } else {
      console.error("[dashboard] claimAccount failed:", error);
      errorMessage = "Unable to claim dashboard access.";
    }
  }

  if (shouldRedirectToDashboard) {
    await invalidateDashboardBootstrapCache(session.access_token);
    revalidatePath("/dashboard");
    captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.accountClaimSucceeded,
      {
        feature: "account_claim",
        outcome: "succeeded",
        app_surface: "dashboard",
      },
      { distinctId: session.user.id },
    );
    return succeeded("Dashboard access linked. Redirecting to dashboard.", {
      redirectTo: "/dashboard",
      refresh: false,
      onboardingState: "claimed_free_account",
    });
  }

  captureServerAnalyticsEvent(
    ANALYTICS_EVENTS.accountClaimFailed,
    {
      error_code: errorMessage ? "account_claim_failed" : "account_claim_unknown",
      feature: "account_claim",
      outcome: "failed",
      app_surface: "dashboard",
    },
    { distinctId: session.user.id },
  );
  return failed(errorMessage ?? "Unable to claim dashboard access.");
}
