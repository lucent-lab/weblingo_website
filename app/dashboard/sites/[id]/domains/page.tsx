import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ExternalLink, Languages, RefreshCw, ServerCog, ShieldCheck } from "lucide-react";

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

import {
  provisionDomainAction,
  refreshDomainAction,
  setLocaleServingAction,
  translateAndServeAction,
  verifyDomainAction,
} from "../../../actions";
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
type CustomerLanguage = DomainsProjection["languages"][number];

export default async function DomainsPage({ params }: DomainsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
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
          description="We could not load domain verification and serving readiness for this site."
          message="Unable to load domain setup."
          siteId={id}
          retryHref={`/dashboard/sites/${id}/domains`}
          retryLabel="Retry domains"
          nextSteps={[
            "Retry domain setup.",
            "Open the site overview to continue with other site work.",
            "Contact support if domain setup remains unavailable.",
          ]}
        />
      );
    }
    notFound();
  }
  try {
    assertDomainSetupInstructions(projection.domains);
  } catch (err) {
    console.warn("[dashboard] domain setup projection failed contract validation", {
      siteId: id,
      subjectAccountId: auth.subjectAccountId,
      error: err,
    });
    return (
      <FocusedRouteErrorState
        error={
          new WebhooksApiError("The dashboard received incomplete domain setup data.", 200, {
            code: "dashboard_domain_setup_contract_mismatch",
          })
        }
        title="Unable to load domains"
        description="We could not load domain verification and serving readiness for this site."
        message="Unable to load domain setup."
        siteId={id}
        retryHref={`/dashboard/sites/${id}/domains`}
        retryLabel="Retry domains"
        nextSteps={[
          "Retry domain setup once.",
          "Open the site overview to continue with other site work.",
          "Contact support if domain setup remains unavailable.",
        ]}
      />
    );
  }

  const headerLabels = buildSiteHeaderLabels(t);
  const mutationsLocked = !auth.mutationsAllowed || !projection.access.mutationsAllowed;
  const canTranslateAndServe =
    canEdit &&
    !mutationsLocked &&
    Boolean(projection.access.features.crawl_trigger && projection.access.features.serve);
  const canToggleServing = canEdit && projection.access.canToggleServing && !mutationsLocked;

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
          projection.domains.map((domain, index) => (
            <DomainCard
              key={`${domain.domain}:${domain.targetLang ?? "source"}:${index}`}
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

      <ServingLanguagesCard
        canToggleServing={canToggleServing}
        canTranslateAndServe={canTranslateAndServe}
        languages={projection.languages}
        siteId={projection.site.id}
        siteStatus={projection.site.status}
        t={t}
      />
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
  const dnsMode = domain.status === "verified" ? null : resolveDomainDnsMode(domain);
  const showVerify = dnsMode === "txt";
  const showProvision = dnsMode === "cname";

  return (
    <Card id={domainAnchorId(domain.domain)} className="scroll-mt-24">
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
      <CardContent className="space-y-4">
        {domain.status !== "verified" ? <DomainDnsRecords domain={domain} /> : null}
        <div className="flex flex-wrap gap-2">
          {showVerify ? (
            <DomainActionForm
              action={verifyDomainAction}
              domain={domain.domain}
              enabled={canVerify}
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Verify domain"
              loading="Checking DNS..."
              siteId={siteId}
              siteStatus={siteStatus}
            />
          ) : null}
          {showProvision ? (
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
          ) : null}
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
        </div>
      </CardContent>
    </Card>
  );
}

function DomainDnsRecords({ domain }: { domain: CustomerDomain }) {
  const records = domain.requiredDns ?? [];
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium text-foreground">Required DNS record</p>
        <p className="text-xs text-muted-foreground">
          Add this record at your DNS provider, then run the matching action below.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border/60 bg-background">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr className="border-t border-border/50" key={`${record.type}:${record.name}`}>
                <td className="px-3 py-2 font-mono text-xs">{record.type}</td>
                <td className="px-3 py-2 font-mono text-xs">{record.name}</td>
                <td className="break-all px-3 py-2 font-mono text-xs">{record.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
    <ActionForm
      action={action}
      loading={loading}
      success={label}
      error={`Unable to ${label}.`}
      refreshOnSuccess={true}
    >
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

function ServingLanguagesCard({
  canToggleServing,
  canTranslateAndServe,
  languages,
  siteId,
  siteStatus,
  t,
}: {
  canToggleServing: boolean;
  canTranslateAndServe: boolean;
  languages: CustomerLanguage[];
  siteId: string;
  siteStatus: string;
  t: Translator;
}) {
  if (!languages.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Serving languages</CardTitle>
        <CardDescription>
          Serve translated pages on verified domains after a successful publish.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Language</th>
                <th className="px-3 py-2 text-left">Domain</th>
                <th className="px-3 py-2 text-left">Serving</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((language, index) => (
                <ServingLanguageRow
                  key={`${language.tag}:${language.domain ?? "domain"}:${index}`}
                  canToggleServing={canToggleServing}
                  canTranslateAndServe={canTranslateAndServe}
                  language={language}
                  siteId={siteId}
                  siteStatus={siteStatus}
                  t={t}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ServingLanguageRow({
  canToggleServing,
  canTranslateAndServe,
  language,
  siteId,
  siteStatus,
  t,
}: {
  canToggleServing: boolean;
  canTranslateAndServe: boolean;
  language: CustomerLanguage;
  siteId: string;
  siteStatus: string;
  t: Translator;
}) {
  const servingValue = language.servingStatus.value;
  const servingLabel = formatCustomerCopy(t, language.servingStatus.titleKey, {
    fallback: formatCustomerStatusValue(servingValue),
  });
  const toggleLabel = language.serveEnabled ? "Disable serving" : "Enable serving";
  const toggleValue = language.serveEnabled ? "false" : "true";
  const canStartTranslation = canTranslateAndServe && servingValue === "ready";

  return (
    <tr className="border-t border-border/50">
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Languages className="h-4 w-4 text-muted-foreground" />
          {language.tag.toUpperCase()}
        </div>
        {language.alias ? (
          <p className="mt-1 text-xs text-muted-foreground">Alias: {language.alias}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1">
          <p className="text-foreground">{language.domain ?? "-"}</p>
          {language.domainStatus ? <StatusValueBadge status={language.domainStatus} /> : null}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <StatusBadge tone={toneForStatus(servingValue)}>{servingLabel}</StatusBadge>
      </td>
      <td className="px-3 py-3 text-right align-top">
        <div className="flex flex-col items-end gap-2">
          {servingValue === "live" && language.domain ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`https://${language.domain}`} rel="noreferrer" target="_blank">
                <ExternalLink className="h-4 w-4" />
                View live
              </Link>
            </Button>
          ) : servingValue === "ready" ? (
            <ActionForm
              action={translateAndServeAction}
              loading="Starting translation..."
              success="Translation started."
              error="Unable to start translation."
              refreshOnSuccess={true}
            >
              <>
                <input name="siteId" type="hidden" value={siteId} />
                <input name="siteStatus" type="hidden" value={siteStatus} />
                <input name="targetLang" type="hidden" value={language.tag} />
                <Button
                  disabled={!canStartTranslation}
                  size="sm"
                  title={canStartTranslation ? "Start translation and serving." : "Unavailable."}
                  type="submit"
                  variant="outline"
                >
                  Translate & serve
                </Button>
              </>
            </ActionForm>
          ) : servingValue === "needs_domain" && language.domain ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`#${domainAnchorId(language.domain)}`}>Review DNS setup</Link>
            </Button>
          ) : servingValue === "needs_domain" ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/sites/${siteId}/settings`}>Configure domain</Link>
            </Button>
          ) : null}
          {servingValue !== "inactive" ? (
            <ActionForm
              action={setLocaleServingAction}
              loading="Updating serving..."
              success="Serving updated."
              error="Unable to update serving."
              refreshOnSuccess={true}
            >
              <>
                <input name="siteId" type="hidden" value={siteId} />
                <input name="targetLang" type="hidden" value={language.tag} />
                <input name="enabled" type="hidden" value={toggleValue} />
                <Button
                  disabled={!canToggleServing}
                  size="sm"
                  title={toggleLabel}
                  type="submit"
                  variant="outline"
                >
                  {toggleLabel}
                </Button>
              </>
            </ActionForm>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function assertDomainSetupInstructions(domains: CustomerDomain[]) {
  const missing = domains.find(
    (domain) =>
      domain.status !== "verified" && (!domain.requiredDns || domain.requiredDns.length === 0),
  );
  if (missing) {
    throw new Error(`Missing DNS setup instructions for customer domain ${missing.domain}.`);
  }
  const unsupported = domains.find((domain) =>
    (domain.requiredDns ?? []).some((record) => !isSupportedDnsRecordType(record.type)),
  );
  if (unsupported) {
    throw new Error(`Unsupported DNS setup record type for customer domain ${unsupported.domain}.`);
  }
}

function resolveDomainDnsMode(domain: CustomerDomain): "cname" | "txt" {
  const records = domain.requiredDns ?? [];
  if (records.some((record) => record.type.toUpperCase() === "CNAME")) {
    return "cname";
  }
  if (records.some((record) => record.type.toUpperCase() === "TXT")) {
    return "txt";
  }
  throw new Error(`Unsupported DNS setup record type for customer domain ${domain.domain}.`);
}

function isSupportedDnsRecordType(type: string): boolean {
  const normalized = type.toUpperCase();
  return normalized === "CNAME" || normalized === "TXT";
}

function domainAnchorId(domain: string): string {
  return `domain-${domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
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
