"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AuthFormState = {
  error: string | null;
};

function toFriendlySupabaseAuthError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Unexpected error";

  const normalized = message.toLowerCase();
  if (normalized.includes("fetch failed") || normalized.includes("failed to fetch")) {
    return [
      "Unable to reach Supabase.",
      "If running locally, make sure Supabase is running and your",
      "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set correctly.",
    ].join(" ");
  }

  return message;
}

export async function login(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Supabase login failed:", error);
    return { error: toFriendlySupabaseAuthError(error) };
  }

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  try {
    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      console.error("Supabase login failed:", error);
      return { error: toFriendlySupabaseAuthError(error) };
    }
  } catch (error) {
    console.error("Supabase login failed:", error);
    return { error: toFriendlySupabaseAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Supabase signup failed:", error);
    return { error: toFriendlySupabaseAuthError(error) };
  }

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  try {
    const { error } = await supabase.auth.signUp(data);

    if (error) {
      console.error("Supabase signup failed:", error);
      return { error: toFriendlySupabaseAuthError(error) };
    }
  } catch (error) {
    console.error("Supabase signup failed:", error);
    return { error: toFriendlySupabaseAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
