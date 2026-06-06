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
import { resolveLocaleTranslator, type Translator } from "@internal/i18n";

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

      <QualityProofCard isDemoAccess={auth.accessMode === "demo"} t={t} />

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

function QualityProofCard({ isDemoAccess, t }: { isDemoAccess: boolean; t: Translator }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.quality.title", "Quality")}</CardTitle>
        <CardDescription className="space-y-1">
          <span className="block font-medium text-foreground">
            {t("dashboard.quality.proof.title", "Translation control proof")}
          </span>
          <span className="block">
            {isDemoAccess
              ? t(
                  "dashboard.quality.proof.demoDescription",
                  "Real saved controls appear first. When a control has no saved entries yet, the demo stays read-only and labels any examples before showing them.",
                )
              : t(
                  "dashboard.quality.proof.description",
                  "Review the controls that keep translated content consistent before changing the live site.",
                )}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ProofPoint
          title={t("dashboard.quality.proof.glossary.title", "Glossary")}
          description={t(
            "dashboard.quality.proof.glossary.description",
            "Approved product, brand, and domain terms stay consistent across locales.",
          )}
        />
        <ProofPoint
          title={t("dashboard.quality.proof.overrides.title", "Manual overrides")}
          description={t(
            "dashboard.quality.proof.overrides.description",
            "Exact phrases can be pinned when machine output needs human direction.",
          )}
        />
        <ProofPoint
          title={t("dashboard.quality.proof.slugs.title", "Localized slugs")}
          description={t(
            "dashboard.quality.proof.slugs.description",
            "Translated URL paths can be reviewed separately from page content.",
          )}
        />
        <ProofPoint
          title={t("dashboard.quality.proof.consistency.title", "Consistency")}
          description={t(
            "dashboard.quality.proof.consistency.description",
            "Canonical phrases and override conflicts stay visible for rollout review.",
          )}
        />
      </CardContent>
    </Card>
  );
}

function ProofPoint({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
