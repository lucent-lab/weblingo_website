"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_EVENTS } from "@internal/analytics/events";
import { captureServerAnalyticsEvent } from "@internal/analytics/server";
import { envServer } from "@internal/core/env-server";
import { clearSubjectAccountId } from "@internal/dashboard/workspace";

type AuthFormState = {
  error: string | null;
  notice: string | null;
};

type AuthActionKind = "login" | "signup";

function resolveAuthRedirectPath(formData: FormData): string {
  const value = String(formData.get("redirectTo") ?? "").trim();
  if (
    value === "/dashboard" ||
    value.startsWith("/dashboard/") ||
    value.startsWith("/dashboard?")
  ) {
    return value;
  }
  return "/dashboard";
}

function toFriendlySupabaseAuthError(error: unknown, action: AuthActionKind): string {
  const rawMessage =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Unexpected error";

  const message = rawMessage.trim() || "Unexpected error";
  const normalized = message.toLowerCase();
  const isDev = process.env.NODE_ENV !== "production";

  if (normalized.includes("fetch failed") || normalized.includes("failed to fetch")) {
    if (isDev) {
      return [
        "Unable to reach Supabase.",
        "If running locally, make sure Supabase is running and your",
        "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set correctly.",
      ].join(" ");
    }
    return "Unable to reach the authentication service. Please try again later.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "Too many attempts. Please try again later.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return "If an account exists for this email, you will receive an email with next steps.";
  }

  if (normalized.includes("password") && normalized.includes("should be at least")) {
    return "Password is too short.";
  }

  if (!isDev) {
    return action === "login"
      ? "Unable to sign in. Please try again."
      : "Unable to create account. Please try again.";
  }

  return message;
}

export async function login(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    redirect("/");
  }
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Supabase login failed:", error);
    captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
      auth_action: "login",
      auth_method: "password",
      error_code: "auth_client_unavailable",
      feature: "dashboard_auth",
      outcome: "failed",
      app_surface: "auth",
    });
    return { error: toFriendlySupabaseAuthError(error, "login"), notice: null };
  }

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  try {
    const { data: result, error } = await supabase.auth.signInWithPassword(data);

    if (error) {
      console.error("Supabase login failed:", error);
      captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
        auth_action: "login",
        auth_method: "password",
        email_present: Boolean(data.email),
        error_code: "auth_rejected",
        feature: "dashboard_auth",
        outcome: "failed",
        app_surface: "auth",
      });
      return { error: toFriendlySupabaseAuthError(error, "login"), notice: null };
    }

    if (!result.session) {
      captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
        auth_action: "login",
        auth_method: "password",
        email_present: Boolean(data.email),
        error_code: "auth_session_missing",
        feature: "dashboard_auth",
        outcome: "failed",
        app_surface: "auth",
      });
      return {
        error: null,
        notice: "Signed in, but no session was created. Please check your email and try again.",
      };
    }
    captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.authSucceeded,
      {
        auth_action: "login",
        auth_method: "password",
        email_present: Boolean(data.email),
        feature: "dashboard_auth",
        outcome: "succeeded",
        app_surface: "auth",
      },
      { distinctId: result.user?.id },
    );
  } catch (error) {
    console.error("Supabase login failed:", error);
    captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
      auth_action: "login",
      auth_method: "password",
      email_present: Boolean(data.email),
      error_code: "auth_exception",
      feature: "dashboard_auth",
      outcome: "failed",
      app_surface: "auth",
    });
    return { error: toFriendlySupabaseAuthError(error, "login"), notice: null };
  }

  revalidatePath("/", "layout");
  await clearSubjectAccountId();
  redirect(resolveAuthRedirectPath(formData));
}

export async function signup(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    redirect("/");
  }
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Supabase signup failed:", error);
    captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
      auth_action: "signup",
      auth_method: "password",
      error_code: "auth_client_unavailable",
      feature: "dashboard_auth",
      outcome: "failed",
      app_surface: "auth",
    });
    return { error: toFriendlySupabaseAuthError(error, "signup"), notice: null };
  }

  const data = {
    email: (formData.get("email") as string | null)?.trim() ?? "",
    password: (formData.get("password") as string | null) ?? "",
  };

  try {
    const { data: result, error } = await supabase.auth.signUp(data);

    if (error) {
      console.error("Supabase signup failed:", error);
      captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
        auth_action: "signup",
        auth_method: "password",
        email_present: Boolean(data.email),
        error_code: "auth_rejected",
        feature: "dashboard_auth",
        outcome: "failed",
        app_surface: "auth",
      });
      return { error: toFriendlySupabaseAuthError(error, "signup"), notice: null };
    }

    if (!result.session) {
      captureServerAnalyticsEvent(ANALYTICS_EVENTS.authSucceeded, {
        auth_action: "signup",
        auth_method: "password",
        email_present: Boolean(data.email),
        feature: "dashboard_auth",
        outcome: "email_confirmation_required",
        app_surface: "auth",
      });
      return {
        error: null,
        notice:
          "Check your email for a confirmation link. If you already have an account, use “Log in” instead.",
      };
    }
    captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.authSucceeded,
      {
        auth_action: "signup",
        auth_method: "password",
        email_present: Boolean(data.email),
        feature: "dashboard_auth",
        outcome: "succeeded",
        app_surface: "auth",
      },
      { distinctId: result.user?.id },
    );
  } catch (error) {
    console.error("Supabase signup failed:", error);
    captureServerAnalyticsEvent(ANALYTICS_EVENTS.authFailed, {
      auth_action: "signup",
      auth_method: "password",
      email_present: Boolean(data.email),
      error_code: "auth_exception",
      feature: "dashboard_auth",
      outcome: "failed",
      app_surface: "auth",
    });
    return { error: toFriendlySupabaseAuthError(error, "signup"), notice: null };
  }

  revalidatePath("/", "layout");
  await clearSubjectAccountId();
  redirect(resolveAuthRedirectPath(formData));
}
