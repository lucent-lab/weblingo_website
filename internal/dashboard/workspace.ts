import { cookies } from "next/headers";

export const SUBJECT_ACCOUNT_COOKIE = "weblingo_dashboard_subject";

export async function readSubjectAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SUBJECT_ACCOUNT_COOKIE)?.value?.trim();
  if (!value || value === "undefined" || value === "null") {
    return null;
  }
  return value;
}
