"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AuthFormState = {
  error: string | null;
};

export async function login(_: AuthFormState, formData: FormData): Promise<AuthFormState | void> {
  const supabase = await createClient();

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.error("Supabase login failed:", error);
    return { error: error.message || "Invalid login credentials" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(_: AuthFormState, formData: FormData): Promise<AuthFormState | void> {
  const supabase = await createClient();

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Supabase signup failed:", error);
    return { error: error.message || "Unable to create your account. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
