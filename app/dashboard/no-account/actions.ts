"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { env } from "@internal/core";

export async function claimAccount() {
  if (env.PUBLIC_PORTAL_MODE !== "enabled") {
    redirect("/");
  }
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/auth/login");
  }

  const apiBase = env.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");

  let shouldRedirectToDashboard = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(`${apiBase}/accounts/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

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
    errorMessage = error instanceof Error ? error.message : "Unable to claim account";
  }

  if (shouldRedirectToDashboard) {
    redirect("/dashboard");
  }

  redirect(
    `/dashboard/no-account?error=${encodeURIComponent(errorMessage ?? "Unable to claim account")}`,
  );
}
