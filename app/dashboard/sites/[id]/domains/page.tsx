import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { RefreshCw, ServerCog, ShieldCheck } from "lucide-react";

import { ActionForm } from "@/components/dashboard/action-form";
import { MutationLockBanner } from "@/components/dashboard/mutation-lock-banner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { formatCustomerCopy, formatCustomerStatusValue } from "@internal/dashboard/customer-copy";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import { provisionDomainAction, refreshDomainAction, verifyDomainAction } from "../../../actions";
import {
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatDate,
  StatusValueBadge,
  toneForStatus,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "Domains",
  robots: { index: false, follow: false },
};

type DomainsPageProps = {
  params: Promise<{ id: string }>;
};

type DomainsProjection = Extract<SiteDashboardProjectionResponse, { meta: { view: "domains" } }>;
type CustomerDomain = DomainsProjection["domains"][number];

export default async function DomainsPage({ params }: DomainsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;

  let projection: DomainsProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "domains");
    projection = isDomainsProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    logProjectionError("domains", id, auth, err);
  }

  if (!projection) {
    if (error) {
      return (
        <FocusedRouteErrorState
          error={error}
          title="Unable to load domains"
          description="We could not complete your request. You can retry or return to the dashboard."
          message="Unable to load domains."
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
        description="Domain changes are locked until this workspace can make dashboard mutations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Domains</CardTitle>
          <CardDescription>
            Customer-visible domain verification, routing, and serving readiness.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">URL mode</p>
            <p className="font-medium">{projection.routing.urlMode ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Serving mode</p>
            <p className="font-medium">{projection.routing.servingMode ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Route prefixes</p>
            <p className="font-medium">{projection.routing.routePrefixes.length}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {projection.domains.length ? (
          projection.domains.map((domain) => (
            <DomainCard
              key={`${domain.domain}:${domain.targetLang ?? "source"}`}
              domain={domain}
              canVerify={canEdit && projection.access.canVerifyDomain && !mutationsLocked}
              canRefresh={canEdit && projection.access.canRefreshDomain && !mutationsLocked}
              canProvision={canEdit && projection.access.canProvisionDomain && !mutationsLocked}
              siteStatus={projection.site.status}
              siteId={projection.site.id}
              t={t}
            />
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No domains</CardTitle>
              <CardDescription>
                Add translated domains from settings before serving localized pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={`/dashboard/sites/${projection.site.id}/settings`}>Open settings</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function isDomainsProjection(
  payload: SiteDashboardProjectionResponse,
): payload is DomainsProjection {
  return payload.meta.view === "domains";
}

function DomainCard({
  domain,
  siteId,
  siteStatus,
  canVerify,
  canRefresh,
  canProvision,
  t,
}: {
  domain: CustomerDomain;
  siteId: string;
  siteStatus: string;
  canVerify: boolean;
  canRefresh: boolean;
  canProvision: boolean;
  t: Translator;
}) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="break-words text-lg">{domain.domain}</CardTitle>
          <CardDescription>
            {domain.targetLang ? domain.targetLang.toUpperCase() : "Unassigned"} - last checked{" "}
            {formatDate(domain.lastCheckedAt)}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <StatusValueBadge status={domain.status} />
          {domain.servingStatus ? (
            <StatusBadge tone={toneForStatus(domain.servingStatus.value)}>
              {formatCustomerCopy(t, domain.servingStatus.titleKey, {
                fallback: formatCustomerStatusValue(domain.servingStatus.value),
              })}
            </StatusBadge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <DomainActionForm
          action={verifyDomainAction}
          domain={domain.domain}
          enabled={canVerify}
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Check DNS"
          loading="Checking DNS..."
          siteId={siteId}
          siteStatus={siteStatus}
        />
        <DomainActionForm
          action={provisionDomainAction}
          domain={domain.domain}
          enabled={canProvision}
          icon={<ServerCog className="h-4 w-4" />}
          label="Provision domain"
          loading="Requesting provisioning..."
          siteId={siteId}
          siteStatus={siteStatus}
        />
        <DomainActionForm
          action={refreshDomainAction}
          domain={domain.domain}
          enabled={canRefresh}
          icon={<RefreshCw className="h-4 w-4" />}
          label="Refresh status"
          loading="Refreshing domain..."
          siteId={siteId}
          siteStatus={siteStatus}
        />
      </CardContent>
    </Card>
  );
}

function DomainActionForm({
  action,
  domain,
  enabled,
  icon,
  label,
  loading,
  siteId,
  siteStatus,
}: {
  action: typeof verifyDomainAction;
  domain: string;
  enabled: boolean;
  icon: ReactNode;
  label: string;
  loading: string;
  siteId: string;
  siteStatus: string;
}) {
  return (
    <ActionForm action={action} loading={loading} success={label} error={`Unable to ${label}.`}>
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="domain" value={domain} />
      <input type="hidden" name="siteStatus" value={siteStatus} />
      <Button disabled={!enabled} size="sm" type="submit" variant="outline">
        {icon}
        {label}
      </Button>
    </ActionForm>
  );
}

function logProjectionError(
  view: string,
  siteId: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn(`[dashboard] fetch ${view} projection failed`, {
      siteId,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn(`[dashboard] fetch ${view} projection failed (unknown error)`, {
      siteId,
      message: err,
    });
  }
}
