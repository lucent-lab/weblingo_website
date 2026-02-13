"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/app/dashboard/actions";
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
    } else {
      const payload = await response.json().catch(() => ({}));
      errorMessage =
        (payload?.error as string) ??
        (payload?.message as string) ??
        `Request failed with status ${response.status}`;
    }
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      errorMessage = "The request timed out. Please retry.";
    } else {
      errorMessage = error instanceof Error ? error.message : "Unable to claim account";
    }
  }

  if (shouldRedirectToDashboard) {
    return succeeded("Account linked. Redirecting to dashboard.", {
      redirectTo: "/dashboard",
      refresh: false,
    });
  }

  return failed(errorMessage ?? "Unable to claim account");
}
