import Link from "next/link";

import { Home, LifeBuoy } from "lucide-react";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCustomerStatusValue,
  formatNullableDateTime,
} from "@internal/dashboard/customer-copy";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import {
  normalizeLocale,
  resolvePreferredLocale,
  type Locale,
  type Translator,
} from "@internal/i18n";

export type DashboardRouteSearchParams = Record<string, string | string[] | undefined>;

export type DashboardRouteLocale = {
  locale: Locale;
  dashboardLocale: Locale | null;
};

export function resolveDashboardRouteLocale(
  searchParams: DashboardRouteSearchParams | undefined,
  acceptLanguage: string | null,
): DashboardRouteLocale {
  const requestedLocale = getSingleDashboardSearchParam(searchParams?.locale);
  if (requestedLocale) {
    const locale = normalizeLocale(requestedLocale);
    return { locale, dashboardLocale: locale };
  }
  return {
    locale: resolvePreferredLocale(acceptLanguage),
    dashboardLocale: null,
  };
}

export function getSingleDashboardSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function localizeDashboardRouteHref(
  href: string | null,
  dashboardLocale: string | null | undefined,
): string | null {
  if (!href || !href.startsWith("/dashboard/sites/")) {
    return href;
  }
  return withDashboardLocale(href, dashboardLocale);
}

export function buildSiteHeaderLabels(t: Translator) {
  return {
    deactivateLabel: t("dashboard.site.status.deactivate"),
    reactivateLabel: t("dashboard.site.status.reactivate"),
    deactivateConfirm: t("dashboard.site.status.deactivateConfirm"),
    activateHelpLabel: t("dashboard.site.status.activateHelpLabel"),
    activateHelp: t("dashboard.site.status.activateHelp"),
  };
}

export function buildSiteHeaderAccess(auth: {
  has(requirement: { feature: "edit" }): boolean;
  mutationsAllowed: boolean;
}) {
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  return {
    canEdit,
    canPauseTranslations: canEdit,
    canResumeTranslations: canEdit,
  };
}

export function FocusedRouteErrorState({
  error,
  title,
  description,
  message,
  siteId,
  retryHref,
  retryLabel = "Retry section",
  nextSteps,
  dashboardLocale = null,
}: {
  error: unknown;
  title: string;
  description: string;
  message: string;
  siteId?: string;
  retryHref?: string;
  retryLabel?: string;
  nextSteps?: string[];
  dashboardLocale?: string | null;
}) {
  const errorView = resolveDashboardErrorView(error, { title, description, message });
  const supportSubject = encodeURIComponent(
    `Dashboard ${errorView.kind}${errorView.referenceCode ? ` ${errorView.referenceCode}` : ""}`,
  );
  const localizedRetryHref = retryHref
    ? localizeDashboardRouteHref(retryHref, dashboardLocale)
    : null;
  const localizedSiteHref = siteId
    ? localizeDashboardRouteHref(`/dashboard/sites/${siteId}`, dashboardLocale)
    : null;
  return (
    <ErrorStateCard
      title={errorView.title}
      description={errorView.description}
      message={errorView.message}
      nextSteps={nextSteps ?? errorView.nextSteps}
      referenceCode={errorView.referenceCode}
      technicalDetails={errorView.technicalDetails}
      actions={
        <>
          {localizedRetryHref ? (
            <DashboardRetryButton href={localizedRetryHref} label={retryLabel} />
          ) : null}
          {localizedSiteHref ? (
            <Button asChild variant="outline">
              <Link href={localizedSiteHref}>
                <Home className="h-4 w-4" aria-hidden="true" />
                Site overview
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home className="h-4 w-4" aria-hidden="true" />
              Dashboard home
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <a href={`mailto:contact@weblingo.app?subject=${supportSubject}`}>
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Contact support
            </a>
          </Button>
        </>
      }
    />
  );
}

export function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean | null;
}) {
  const displayValue =
    typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : value == null ? "-" : value;
  return (
    <div className="grid gap-1 border-b border-border/60 py-2 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-foreground">{displayValue}</dd>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value?: string | number | null;
  helper?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value ?? "-"}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StatusValueBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={toneForStatus(status)}>{formatCustomerStatusValue(status)}</StatusBadge>
  );
}

export function toneForStatus(status: string): StatusTone {
  if (
    status === "active" ||
    status === "healthy" ||
    status === "verified" ||
    status === "live" ||
    status === "published" ||
    status === "completed" ||
    status === "ok"
  ) {
    return "success";
  }
  if (
    status === "pending" ||
    status === "queued" ||
    status === "in_progress" ||
    status === "publishing" ||
    status === "ready" ||
    status === "needs_domain" ||
    status === "warning"
  ) {
    return "warning";
  }
  if (status === "failed" || status === "danger" || status === "blocked") {
    return "danger";
  }
  return "neutral";
}

export function formatCount(value?: number | null): string {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

export function formatDate(value?: string | null): string {
  return formatNullableDateTime(value);
}
