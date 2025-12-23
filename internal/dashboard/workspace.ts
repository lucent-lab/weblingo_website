import { cookies } from "next/headers";

export const SUBJECT_ACCOUNT_COOKIE = "weblingo_dashboard_subject";

export async function readSubjectAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SUBJECT_ACCOUNT_COOKIE)?.value?.trim();
  return value ? value : null;
}
