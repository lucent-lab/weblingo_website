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

export default function LoginPage() {
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
            <Button className="w-full sm:flex-1" formAction={login}>
              Log in
            </Button>
            <Button className="w-full sm:flex-1" variant="outline" formAction={signup}>
              Create account
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

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};
import type { Metadata } from "next";
