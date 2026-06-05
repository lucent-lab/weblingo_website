import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ArrowRight, Languages, ListChecks, PencilLine, Route } from "lucide-react";

import { MutationLockBanner } from "@/components/dashboard/mutation-lock-banner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator } from "@internal/i18n";

import {
  buildSiteHeaderAccess,
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatCount,
  localizeDashboardRouteHref,
  MetricCard,
  resolveDashboardRouteLocale,
  toneForStatus,
  type DashboardRouteSearchParams,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "Quality",
  robots: { index: false, follow: false },
};

type QualityPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DashboardRouteSearchParams>;
};

type QualityProjection = Extract<SiteDashboardProjectionResponse, { meta: { view: "quality" } }>;

export default async function QualityPage({ params, searchParams }: QualityPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  if (!isDashboardAuthScopedToSite(auth, id)) {
    notFound();
  }
  const authToken = auth.webhooksAuth!;
  const routeLocale = resolveDashboardRouteLocale(
    resolvedSearchParams,
    (await headers()).get("accept-language"),
  );
  const locale = routeLocale.locale;
  const dashboardLocale = routeLocale.dashboardLocale;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const siteHeaderAccess = buildSiteHeaderAccess(auth);

  let projection: QualityProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "quality");
    projection = isQualityProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    logProjectionError(id, auth, err);
  }

  if (!projection) {
    if (error) {
      return (
        <FocusedRouteErrorState
          error={error}
          title="Unable to load quality"
          description="We could not load translation quality and coverage data for this site."
          message="Unable to load quality data."
          siteId={id}
          retryHref={`/dashboard/sites/${id}/quality`}
          retryLabel="Retry quality"
          dashboardLocale={dashboardLocale}
          nextSteps={[
            "Retry quality data.",
            "Open the site overview to check current blockers and activity.",
            "Contact support if quality data remains unavailable.",
          ]}
        />
      );
    }
    notFound();
  }

  const headerLabels = buildSiteHeaderLabels(t);
  const mutationsLocked = !auth.mutationsAllowed || !projection.access.mutationsAllowed;

  return (
    <div className="space-y-8">
      <SiteHeader
        site={projection.site}
        canEdit={siteHeaderAccess.canEdit}
        canPauseTranslations={siteHeaderAccess.canPauseTranslations}
        canResumeTranslations={siteHeaderAccess.canResumeTranslations}
        dashboardLocale={dashboardLocale}
        {...headerLabels}
      />

      <MutationLockBanner
        locked={mutationsLocked}
        description="Quality changes are locked until this workspace can make dashboard mutations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Quality</CardTitle>
          <CardDescription>
            Translation quality entry points stay focused and load details only after opening a
            workflow.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Glossary"
          value={formatCount(projection.glossarySummary?.entriesCount)}
          helper="Source terms"
        />
        <MetricCard
          label="Overrides"
          value={formatCount(projection.overrideSummary?.entriesCount)}
          helper="Manual entries"
        />
        <MetricCard
          label="Localized slugs"
          value={formatCount(projection.slugSummary?.localizedSlugCount)}
          helper="Configured paths"
        />
        <MetricCard
          label="Slug conflicts"
          value={formatCount(projection.slugSummary?.conflicts)}
          helper="Needs review"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QualityWorkflowCard
          available={projection.access.canUseGlossary}
          description="Manage canonical product, brand, and domain vocabulary."
          href={
            localizeDashboardRouteHref(
              `/dashboard/sites/${projection.site.id}/overrides#glossary`,
              dashboardLocale,
            )!
          }
          icon={<Languages className="h-4 w-4" />}
          title="Glossary"
        />
        <QualityWorkflowCard
          available={projection.access.canUseOverrides}
          description="Override individual strings when you need exact phrasing."
          href={
            localizeDashboardRouteHref(
              `/dashboard/sites/${projection.site.id}/overrides#manual-overrides`,
              dashboardLocale,
            )!
          }
          icon={<PencilLine className="h-4 w-4" />}
          title="Manual overrides"
        />
        <QualityWorkflowCard
          available={projection.access.canEditSlugs}
          description="Review localized URL paths without exposing deployment internals."
          href={
            localizeDashboardRouteHref(
              `/dashboard/sites/${projection.site.id}/overrides#localized-slugs`,
              dashboardLocale,
            )!
          }
          icon={<Route className="h-4 w-4" />}
          title="Localized slugs"
        />
        <QualityWorkflowCard
          available={projection.access.canUseConsistencyGovernance}
          description="Open consistency governance when the plan supports it."
          href={
            localizeDashboardRouteHref(
              `/dashboard/sites/${projection.site.id}/overrides#consistency-governance`,
              dashboardLocale,
            )!
          }
          icon={<ListChecks className="h-4 w-4" />}
          title="Consistency governance"
        />
      </div>
    </div>
  );
}

function isQualityProjection(
  payload: SiteDashboardProjectionResponse,
): payload is QualityProjection {
  return payload.meta.view === "quality";
}

function QualityWorkflowCard({
  available,
  description,
  href,
  icon,
  title,
}: {
  available: boolean;
  description: string;
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <StatusBadge tone={toneForStatus(available ? "ready" : "disabled")}>
          {available ? "Available" : "Locked"}
        </StatusBadge>
      </CardHeader>
      <CardContent>
        {available ? (
          <Button asChild variant="outline">
            <Link href={href}>
              {icon}
              Open
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button disabled variant="outline">
            {icon}
            Open
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function logProjectionError(
  siteId: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch quality projection failed", {
      siteId,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn("[dashboard] fetch quality projection failed (unknown error)", {
      siteId,
      message: err,
    });
  }
}
