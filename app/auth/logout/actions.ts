"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { clearSubjectAccountId } from "@internal/dashboard/workspace";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSubjectAccountId();
  const { clearDashboardDemoSessionCookie } = await import("@internal/dashboard/demo-session");
  await clearDashboardDemoSessionCookie();
  redirect("/auth/login");
}
