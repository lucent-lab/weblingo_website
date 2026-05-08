"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { logout } from "@/app/auth/logout/actions";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";

type DashboardError = Error & { digest?: string };

export default function DashboardError({
  error,
  reset,
}: {
  error: DashboardError;
  reset: () => void;
}) {
  const router = useRouter();
  const isProd = process.env.NODE_ENV === "production";
  const [showDetails, setShowDetails] = useState(!isProd);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const errorView = useMemo(
    () =>
      resolveDashboardErrorView(error, {
        title: "Dashboard error",
        description:
          "We could not complete your request. You can retry, go back, or return to the dashboard home.",
      }),
    [error],
  );

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <ErrorStateCard
        title={errorView.title}
        description={errorView.description}
        message={errorView.message}
        nextSteps={errorView.nextSteps}
        referenceCode={errorView.referenceCode}
        technicalDetails={errorView.technicalDetails}
        headerBadge={<Badge variant="outline">Status: error</Badge>}
        actions={
          <>
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
              <a href="mailto:contact@weblingo.app">Contact support</a>
            </Button>
          </>
        }
      >
        {!isProd ? (
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
        ) : null}
      </ErrorStateCard>
    </div>
  );
}
