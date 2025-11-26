"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { env } from "@internal/core";

export async function claimAccount() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/auth/login");
  }

  const apiBase = env.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");

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
      // 200 = created/linked, 409 = already exists; both can proceed to dashboard
      redirect("/dashboard");
    }

    const payload = await response.json().catch(() => ({}));
    const reason =
      (payload?.error as string) ??
      (payload?.message as string) ??
      `Request failed with status ${response.status}`;
    redirect(`/dashboard/no-account?error=${encodeURIComponent(reason)}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unable to claim account";
    redirect(`/dashboard/no-account?error=${encodeURIComponent(reason)}`);
  }
}
