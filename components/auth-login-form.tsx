"use client";

import { useActionState, useState } from "react";

import { login, signup } from "@/app/auth/login/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormState = { error: string | null; notice: string | null };
const initialAuthState: AuthFormState = { error: null, notice: null };
type AuthIntent = "login" | "signup";

export function AuthLoginForm() {
  const [loginState, loginAction, loginPending] = useActionState<AuthFormState, FormData>(
    login,
    initialAuthState,
  );
  const [signupState, signupAction, signupPending] = useActionState<AuthFormState, FormData>(
    signup,
    initialAuthState,
  );
  const [intent, setIntent] = useState<AuthIntent | null>(null);

  const activeState =
    intent === "signup"
      ? signupState
      : intent === "login"
        ? loginState
        : signupState.error || signupState.notice
          ? signupState
          : loginState;

  const displayError = activeState.error ?? null;
  const displayNotice = displayError ? null : (activeState.notice ?? null);
  const isSubmitting = loginPending || signupPending;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <form className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to WebLingo</CardTitle>
            <CardDescription>
              Access your localized workspaces or get started with a free trial.
            </CardDescription>
          </CardHeader>
          {displayError ? (
            <div className="mx-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {displayError}
            </div>
          ) : displayNotice ? (
            <div className="mx-6 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
              {displayNotice}
            </div>
          ) : null}
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={intent === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="w-full sm:flex-1"
              disabled={isSubmitting}
              formAction={loginAction}
              onClick={() => setIntent("login")}
            >
              {loginPending ? "Signing in..." : "Log in"}
            </Button>
            <Button
              className="w-full sm:flex-1"
              disabled={isSubmitting}
              variant="outline"
              formAction={signupAction}
              onClick={() => setIntent("signup")}
            >
              {signupPending ? "Creating..." : "Create account"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need help?{" "}
        <a href="mailto:contact@weblingo.app" className="font-medium text-primary">
          Contact support
        </a>
      </p>
    </div>
  );
}
