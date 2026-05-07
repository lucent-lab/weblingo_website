import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ExternalLink, ShieldCheck } from "lucide-react";

import { MutationLockBanner } from "@/components/dashboard/mutation-lock-banner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

import { fetchSwitcherSnippetsAction } from "../../../actions";
import {
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatDate,
  StatusValueBadge,
  SummaryRow,
  toneForStatus,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";
import { SwitcherSnippetsCard } from "./switcher-snippets-card";

export const metadata = {
  title: "Developer tools",
  robots: { index: false, follow: false },
};

type DeveloperToolsPageProps = {
  params: Promise<{ id: string }>;
};

type DeveloperToolsProjection = Extract<
  SiteDashboardProjectionResponse,
  { meta: { view: "developer_tools" } }
>;

export default async function DeveloperToolsPage({ params }: DeveloperToolsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;

  let projection: DeveloperToolsProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "developer_tools");
    projection = isDeveloperToolsProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    logProjectionError(id, auth, err);
  }

  if (!projection) {
    if (error) {
      return (
        <FocusedRouteErrorState
          error={error}
          title="Unable to load developer tools"
          description="We could not complete your request. You can retry or return to the dashboard."
          message="Unable to load developer tools."
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
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        {...headerLabels}
      />

      <MutationLockBanner
        locked={mutationsLocked}
        description="Developer tool changes are locked until this workspace can make dashboard mutations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Developer tools</CardTitle>
          <CardDescription>
            Runtime configuration, snippets, webhooks, and request policy entry points.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Runtime</CardTitle>
            <CardDescription>Client runtime controls and attribute coverage.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <SummaryRow label="Client runtime" value={projection.runtime.clientRuntimeEnabled} />
              <SummaryRow label="Language switcher" value={projection.runtime.switcherEnabled} />
              <SummaryRow label="SPA refresh" value={projection.runtime.spaRefreshEnabled} />
              <SummaryRow
                label="Translatable attributes"
                value={projection.runtime.translatableAttributes?.length ?? 0}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Webhooks</CardTitle>
            <CardDescription>Delivery settings without exposing webhook secrets.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <SummaryRow label="URL" value={projection.webhooks.url} />
              <SummaryRow label="Events" value={projection.webhooks.events.length} />
              <SummaryRow label="Secret configured" value={projection.webhooks.hasSecret} />
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex justify-end">
            <StatusValueBadge status={projection.snippets.available ? "ready" : "disabled"} />
          </div>
          <SwitcherSnippetsCard
            siteId={projection.site.id}
            available={projection.snippets.available}
            action={fetchSwitcherSnippetsAction}
          />
        </div>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Runtime requests</CardTitle>
              <CardDescription>Review observed same-origin runtime request groups.</CardDescription>
            </div>
            <StatusBadge
              tone={toneForStatus(projection.runtimeRequests.available ? "ready" : "disabled")}
            >
              {projection.runtimeRequests.available ? "Ready" : "Disabled"}
            </StatusBadge>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <SummaryRow
                label="Policy rules"
                value={projection.runtimeRequests.policySummary?.rulesCount ?? 0}
              />
              <SummaryRow
                label="Served policy"
                value={projection.runtimeRequests.policySummary?.version}
              />
              <SummaryRow
                label="Route cache"
                value={
                  projection.runtimeRequests.propagation?.stale === true
                    ? "Stale"
                    : projection.runtimeRequests.propagation
                      ? "Current"
                      : "-"
                }
              />
              <SummaryRow
                label="Last policy update"
                value={formatDate(projection.runtimeRequests.policySummary?.lastUpdatedAt)}
              />
            </dl>
            <Button asChild variant="outline">
              <Link href={`/dashboard/sites/${projection.site.id}/runtime-requests`}>
                <ShieldCheck className="h-4 w-4" />
                Open runtime requests
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="link">
        <Link href={`/dashboard/sites/${projection.site.id}/settings`}>
          <ExternalLink className="h-4 w-4" />
          Open settings
        </Link>
      </Button>
    </div>
  );
}

function isDeveloperToolsProjection(
  payload: SiteDashboardProjectionResponse,
): payload is DeveloperToolsProjection {
  return payload.meta.view === "developer_tools";
}

function logProjectionError(
  siteId: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch developer tools projection failed", {
      siteId,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn("[dashboard] fetch developer tools projection failed (unknown error)", {
      siteId,
      message: err,
    });
  }
}
