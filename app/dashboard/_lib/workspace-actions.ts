"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getActiveAgencyCustomers, requireDashboardAuth } from "@internal/dashboard/auth";
import { clearSubjectAccountId, SUBJECT_ACCOUNT_COOKIE } from "@internal/dashboard/workspace";

export async function setWorkspaceAction(formData: FormData) {
  const rawSubjectAccountId = String(formData.get("subjectAccountId") ?? "").trim();
  const subjectAccountId =
    rawSubjectAccountId === "undefined" || rawSubjectAccountId === "null"
      ? ""
      : rawSubjectAccountId;
  const redirectToRaw = String(formData.get("redirectTo") ?? "/dashboard");
  const redirectTo = redirectToRaw.startsWith("/dashboard") ? redirectToRaw : "/dashboard";

  const auth = await requireDashboardAuth();
  const actorId = auth.actorAccount?.accountId ?? auth.account?.accountId;
  if (!actorId) {
    redirect("/dashboard/no-account");
  }

  const allowedIds = new Set<string>([actorId]);
  for (const customer of getActiveAgencyCustomers(auth.agencyCustomers)) {
    allowedIds.add(customer.customerAccountId);
  }

  if (!subjectAccountId || subjectAccountId === actorId) {
    const cookieStore = await cookies();
    cookieStore.delete(SUBJECT_ACCOUNT_COOKIE);
    redirect(redirectTo);
  }

  if (!allowedIds.has(subjectAccountId)) {
    await clearSubjectAccountId();
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  cookieStore.set(SUBJECT_ACCOUNT_COOKIE, subjectAccountId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(redirectTo);
}
