"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { logout } from "@/app/auth/logout/actions";
import {
  ANALYTICS_EVENTS,
  buildNavigationAnalyticsProperties,
  captureAnalyticsEvent,
} from "@internal/analytics/client";
import { hashAnalyticsKeyPart } from "@internal/analytics/error-key";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { createClientTranslator } from "@internal/i18n";
import messages from "@internal/i18n/messages/en.json";

type DashboardError = Error & { digest?: string };

export default function DashboardError({
  error,
  reset,
}: {
  error: DashboardError;
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isProd = process.env.NODE_ENV === "production";
  const [showDetails, setShowDetails] = useState(!isProd);
  const t = useMemo(() => createClientTranslator(messages), []);
  const capturedErrorKey = useRef<string | null>(null);
  const routeTemplate = useMemo(() => resolveDashboardErrorRouteTemplate(pathname), [pathname]);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const errorKey = buildDashboardErrorCaptureKey(error, routeTemplate);
    if (capturedErrorKey.current === errorKey) {
      return;
    }
    capturedErrorKey.current = errorKey;
    captureAnalyticsEvent(ANALYTICS_EVENTS.appErrorViewed, {
      app_surface: "dashboard",
      error_digest_present: Boolean(error.digest),
      error_name: error.name || "Error",
      feature: "dashboard_error",
      handled: true,
      route_template: routeTemplate,
    });
  }, [error, routeTemplate]);

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
            <Button
              onClick={() => {
                captureAnalyticsEvent(ANALYTICS_EVENTS.dashboardErrorRetryClicked, {
                  app_surface: "dashboard",
                  error_digest_present: Boolean(error.digest),
                  feature: "dashboard_error",
                  handled: true,
                  route_template: routeTemplate,
                });
                reset();
              }}
            >
              Retry
            </Button>
            <Button onClick={() => router.back()} variant="outline">
              Go back
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Dashboard home</Link>
            </Button>
            <form action={logout}>
              <SignOutButton>{t("dashboard.auth.signOut", "Sign out")}</SignOutButton>
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

function resolveDashboardErrorRouteTemplate(pathname: string | null): string {
  const routeProperties = buildNavigationAnalyticsProperties({
    pathname: pathname ?? "/dashboard",
  });
  const routeTemplate = routeProperties.route_template;
  return typeof routeTemplate === "string" && routeTemplate.includes("/dashboard")
    ? routeTemplate
    : "/dashboard";
}

function buildDashboardErrorCaptureKey(error: DashboardError, routeTemplate: string): string {
  const digestOrMessage = error.digest ?? hashAnalyticsKeyPart(error.message);
  return `${routeTemplate}:${error.name || "Error"}:${digestOrMessage}`;
}
