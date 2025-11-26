"use client";

import { useActionState } from "react";

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

type AuthFormState = { error: string | null };
const initialAuthState: AuthFormState = { error: null };

export default function LoginPage() {
  const [loginState, loginAction, loginPending] = useActionState<AuthFormState, FormData>(
    login,
    initialAuthState,
  );
  const [signupState, signupAction, signupPending] = useActionState<AuthFormState, FormData>(
    signup,
    initialAuthState,
  );

  const displayError = loginState.error ?? signupState.error ?? null;
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
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button className="w-full sm:flex-1" disabled={isSubmitting} formAction={loginAction}>
              {loginPending ? "Signing in..." : "Log in"}
            </Button>
            <Button
              className="w-full sm:flex-1"
              disabled={isSubmitting}
              variant="outline"
              formAction={signupAction}
            >
              {signupPending ? "Creating..." : "Create account"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need help?{" "}
        <a href="mailto:support@weblingo.com" className="font-medium text-primary">
          Contact support
        </a>
      </p>
    </div>
  );
}
