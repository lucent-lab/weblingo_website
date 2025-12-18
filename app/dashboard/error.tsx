"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logout } from "@/app/auth/logout/actions";

type DashboardError = Error & { digest?: string };

export default function DashboardError({
  error,
  reset,
}: {
  error: DashboardError;
  reset: () => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(process.env.NODE_ENV !== "production");

  useEffect(() => {
    console.error(error);
  }, [error]);

  const isAccountMissing =
    typeof error?.message === "string" && /account not found/i.test(error.message);

  const primaryMessage = useMemo(() => {
    if (isAccountMissing) {
      return "Your account is not provisioned for the dashboard yet.";
    }
    if (!error?.message) return "Something went wrong while loading the dashboard.";
    return error.message;
  }, [error?.message, isAccountMissing]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>
                {isAccountMissing ? "Account not provisioned" : "Dashboard error"}
              </CardTitle>
              <CardDescription>
                {isAccountMissing
                  ? "You are signed in, but your account is not yet enabled for the dashboard. You can try a fresh session or contact support to request access."
                  : "We could not complete your request. You can retry, go back, or return to the dashboard home."}
              </CardDescription>
            </div>
            <Badge variant="outline">Status: error</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-destructive">
            {primaryMessage}
            {error.digest ? (
              <span className="ml-2 text-muted-foreground">(digest: {error.digest})</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={reset}>Retry</Button>
            <Button onClick={() => router.back()} variant="outline">
              Go back
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Dashboard home</Link>
            </Button>
            <form action={logout}>
              <Button size="sm" variant="outline" type="submit">
                Sign out
              </Button>
            </form>
            <Button asChild size="sm" variant="link">
              <a href="mailto:support@weblingo.com">Contact support</a>
            </Button>
          </div>

          <div className="space-y-2">
            <button
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setShowDetails((prev) => !prev)}
              type="button"
            >
              {showDetails ? "Hide technical details" : "Show technical details"}
            </button>
            {showDetails ? (
              <pre className="max-h-[320px] overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
                {error.stack ?? "No stack trace available."}
              </pre>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
