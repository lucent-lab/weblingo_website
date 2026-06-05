import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ArrowRight } from "lucide-react";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { MutationLockBanner } from "@/components/dashboard/mutation-lock-banner";
import { NextActionCard } from "@/components/dashboard/next-action-card";
import { QuotaMeter } from "@/components/dashboard/quota-meter";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  formatCustomerCopy,
  formatCustomerStatusValue,
  formatNullableDateTime,
} from "@internal/dashboard/customer-copy";
import { getSiteCustomerOverviewCached } from "@internal/dashboard/data";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { WebhooksApiError, type SiteCustomerOverviewResponse } from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import { ProspectDemoConversionCard } from "./prospect-demo-conversion-card";

type SitePageProps = {
  params: Promise<{ id: string }>;
};

type CustomerLanguage = SiteCustomerOverviewResponse["languages"][number];
type CustomerDomain = SiteCustomerOverviewResponse["domains"][number];
type CustomerActivity = SiteCustomerOverviewResponse["currentActivity"][number];
type CustomerError = SiteCustomerOverviewResponse["errors"][number];
type CustomerBlocker = SiteCustomerOverviewResponse["blockers"][number];
type CustomerCta = SiteCustomerOverviewResponse["nextAction"]["cta"];

export default async function SitePage({ params }: SitePageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const demoSession = auth.accessMode === "demo" ? auth.demoSession : null;
  if (auth.accessMode === "demo" && demoSession?.siteId !== id) {
    notFound();
  }
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  let overview: SiteCustomerOverviewResponse | null = null;
  let error: unknown = null;

  try {
    overview = await getSiteCustomerOverviewCached(authToken, id);
  } catch (err) {
    error = err;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSiteCustomerOverview failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSiteCustomerOverview failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (!overview) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load site",
        description:
          "We could not load the site overview. No site settings or translations were changed.",
        message: "Unable to load the site overview.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          nextSteps={errorView.nextSteps}
          referenceCode={errorView.referenceCode}
          technicalDetails={errorView.technicalDetails}
          actions={
            <>
              <DashboardRetryButton href={`/dashboard/sites/${id}`} label="Retry overview" />
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard home</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="mailto:contact@weblingo.app?subject=Dashboard%20site%20overview%20unavailable">
                  Contact support
                </a>
              </Button>
            </>
          }
        />
      );
    }
    notFound();
  }

  const site = overview.site;
  const mutationsLocked = !auth.mutationsAllowed || !overview.account.mutationsAllowed;
  const nextActionTitle = formatCustomerCopy(t, overview.nextAction.titleKey, {
    params: overview.nextAction.params,
  });
  const nextActionDescription = overview.nextAction.descriptionKey
    ? formatCustomerCopy(t, overview.nextAction.descriptionKey, {
        params: overview.nextAction.params,
      })
    : null;
  const nextActionHref = resolveCustomerCtaHref({
    action: overview.nextAction.cta,
    pricingPath,
    siteId: site.id,
  });
  const nextActionLabel = overview.nextAction.cta
    ? formatCustomerCopy(t, overview.nextAction.cta.labelKey, {
        fallback: fallbackCtaLabel(overview.nextAction.cta),
        params: overview.nextAction.cta.params,
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={toneForSiteStatus(site.status)}>
              {formatCustomerStatusValue(site.status)}
            </StatusBadge>
            <StatusBadge tone={toneForHealthStatus(overview.health.status)}>
              {formatCustomerCopy(t, overview.health.titleKey, {
                params: overview.health.params,
              })}
            </StatusBadge>
          </div>
          <h2 className="break-words text-2xl font-semibold text-foreground">{site.sourceUrl}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {overview.health.descriptionKey
              ? formatCustomerCopy(t, overview.health.descriptionKey, {
                  params: overview.health.params,
                })
              : "Customer-safe status, setup, and activity for this site."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/pages`}>Pages</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/source-selection`}>Source selection</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/domains`}>Domains</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/quality`}>Quality</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/developer-tools`}>Developer tools</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/history`}>History</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sites/${site.id}/settings`}>Settings</Link>
          </Button>
          <Button asChild variant="link">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <MutationLockBanner
        locked={mutationsLocked}
        title={auth.accessMode === "demo" ? "Scoped demo access" : undefined}
        description={
          auth.accessMode === "demo"
            ? "This demo is read-only until it is activated for your domain."
            : auth.mutationsAllowed
              ? "This account cannot make dashboard changes until its plan allows mutations."
              : "Billing or account status is blocking dashboard mutations for this workspace."
        }
      />

      {demoSession ? <ProspectDemoConversionCard siteId={site.id} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <NextActionCard
          ctaHref={nextActionHref}
          ctaLabel={nextActionLabel}
          description={nextActionDescription}
          severity={overview.nextAction.severity}
          title={nextActionTitle}
        />
        <WorkspaceSummaryCard overview={overview} t={t} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          <LanguagesCard languages={overview.languages} t={t} />
          <DomainsCard domains={overview.domains} t={t} />
          <PagesSummaryCard overview={overview} t={t} />
        </div>
        <div className="space-y-4">
          <BlockersCard blockers={overview.blockers} t={t} />
          <ActivityCard activity={overview.currentActivity} t={t} />
          <ErrorsCard errors={overview.errors} t={t} />
          <QuotasCard overview={overview} t={t} />
        </div>
      </div>
    </div>
  );
}

function WorkspaceSummaryCard({
  overview,
  t,
}: {
  overview: SiteCustomerOverviewResponse;
  t: Translator;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Workspace</CardTitle>
        <CardDescription>Plan and source configuration.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <SummaryRow label="Source language" value={overview.site.sourceLang.toUpperCase()} />
        <SummaryRow label="Serving mode" value={overview.site.servingMode ?? "Not set"} />
        <SummaryRow label="Plan" value={formatCustomerStatusValue(overview.account.planType)} />
        <SummaryRow
          label="Plan status"
          value={formatCustomerStatusValue(overview.account.planStatus)}
        />
        <SummaryRow label="Generated" value={formatNullableDateTime(overview.meta.generatedAt)} />
        <SummaryRow
          label="Last important change"
          value={formatNullableDateTime(overview.health.lastImportantChangeAt)}
        />
        <SummaryRow
          label="Profile"
          value={overview.site.profile ? formatCustomerCopy(t, overview.site.profile) : "Not set"}
        />
      </CardContent>
    </Card>
  );
}

function LanguagesCard({ languages, t }: { languages: CustomerLanguage[]; t: Translator }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Languages</CardTitle>
        <CardDescription>Serving readiness by target language.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {languages.length ? (
          languages.map((language, index) => (
            <div
              className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
              key={`${language.tag}:${index}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {formatCustomerCopy(t, language.labelKey ?? "", {
                      fallback: language.tag.toUpperCase(),
                    })}
                  </p>
                  <StatusBadge tone={language.enabled ? "success" : "neutral"}>
                    {language.enabled ? "enabled" : "disabled"}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language.domain ?? language.routePrefix ?? "No route assigned"}
                </p>
              </div>
              <StatusBadge tone={toneForServingStatus(language.servingStatus.value)}>
                {formatCustomerCopy(t, language.servingStatus.titleKey, {
                  fallback: formatCustomerStatusValue(language.servingStatus.value),
                })}
              </StatusBadge>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No target languages configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function DomainsCard({ domains, t }: { domains: CustomerDomain[]; t: Translator }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Domains</CardTitle>
        <CardDescription>Customer-safe domain and serving state.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {domains.length ? (
          domains.map((domain, index) => (
            <div
              className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
              key={`${domain.domain}:${domain.targetLang ?? "source"}:${index}`}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-foreground">{domain.domain}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {domain.targetLang ? domain.targetLang.toUpperCase() : "No language assigned"} -
                  last checked {formatNullableDateTime(domain.lastCheckedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <StatusBadge tone={toneForDomainStatus(domain.status)}>
                  {formatCustomerStatusValue(domain.status)}
                </StatusBadge>
                {domain.servingStatus ? (
                  <StatusBadge tone={toneForServingStatus(domain.servingStatus.value)}>
                    {formatCustomerCopy(t, domain.servingStatus.titleKey, {
                      fallback: formatCustomerStatusValue(domain.servingStatus.value),
                    })}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No customer domains configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PagesSummaryCard({
  overview,
  t,
}: {
  overview: SiteCustomerOverviewResponse;
  t: Translator;
}) {
  const summary = overview.pagesSummary;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Pages</CardTitle>
          <CardDescription>Capped inventory and crawl summary.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/sites/${overview.site.id}/pages`}>
            Open pages
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Metric label="Known" value={formatNumber(summary.totalKnownPages)} />
        <Metric label="Translated" value={formatNumber(summary.translatedPages)} />
        <Metric
          label="Pending"
          value={formatNumber(summary.pendingPages ?? summary.pagesPending)}
        />
        <Metric label="Failed" value={formatNumber(summary.failedPages)} />
        <Metric label="Eligible now" value={formatNumber(summary.eligiblePageCount)} />
        <Metric label="Next crawl" value={formatNullableDateTime(summary.nextEligibleCrawlAt)} />
        <div className="md:col-span-3">
          <StatusBadge tone={toneForCrawlStatus(summary.customerCrawlStatus ?? "unknown")}>
            {formatCustomerCopy(t, `dashboard.crawl.status.${summary.customerCrawlStatus}`, {
              fallback: formatCustomerStatusValue(summary.customerCrawlStatus ?? "unknown"),
            })}
          </StatusBadge>
          {summary.inventoryMayBeIncomplete ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Inventory may be incomplete while crawl data catches up.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BlockersCard({ blockers, t }: { blockers: CustomerBlocker[]; t: Translator }) {
  if (!blockers.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Blockers</CardTitle>
          <CardDescription>No customer-visible blockers.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Blockers</CardTitle>
        <CardDescription>Issues that can prevent serving or updates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockers.map((blocker, index) => (
          <StatusItem
            description={
              blocker.descriptionKey
                ? formatCustomerCopy(t, blocker.descriptionKey, { params: blocker.params })
                : describeAffectedScope(blocker)
            }
            key={customerBlockerKey(blocker, index)}
            label={formatCustomerCopy(t, blocker.titleKey, { params: blocker.params })}
            tone={toneForSeverity(blocker.severity)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ activity, t }: { activity: CustomerActivity[]; t: Translator }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity</CardTitle>
        <CardDescription>Capped current work summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activity.length ? (
          activity.map((item, index) => (
            <StatusItem
              description={formatActivityDescription(item)}
              key={customerActivityKey(item, index)}
              label={formatCustomerCopy(t, item.titleKey, {
                fallback: formatCustomerStatusValue(item.type),
              })}
              tone={toneForActivityStatus(item.customerStatus)}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active crawl or translation work.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorsCard({ errors, t }: { errors: CustomerError[]; t: Translator }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Errors</CardTitle>
        <CardDescription>Capped customer-safe error summary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errors.length ? (
          errors.map((error, index) => (
            <StatusItem
              description={
                error.descriptionKey
                  ? formatCustomerCopy(t, error.descriptionKey, { params: error.params })
                  : describeErrorScope(error)
              }
              key={`${error.id}:${index}`}
              label={formatCustomerCopy(t, error.titleKey, { params: error.params })}
              tone={toneForSeverity(error.severity)}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No customer-visible errors.</p>
        )}
      </CardContent>
    </Card>
  );
}

function QuotasCard({ overview, t }: { overview: SiteCustomerOverviewResponse; t: Translator }) {
  if (!overview.quotas.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quotas</CardTitle>
        <CardDescription>Plan meters that affect dashboard actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overview.quotas.map((quota, index) => (
          <QuotaMeter
            key={`${quota.key}:${index}`}
            label={formatCustomerCopy(t, quota.labelKey, {
              fallback: formatCustomerStatusValue(quota.key),
            })}
            limit={quota.limit}
            remaining={quota.remaining}
            status={quota.status}
            used={quota.used}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusItem({
  description,
  label,
  tone,
}: {
  description?: string | null;
  label: string;
  tone: StatusTone;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <StatusBadge tone={tone}>{tone}</StatusBadge>
      </div>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function resolveCustomerCtaHref({
  action,
  pricingPath,
  siteId,
}: {
  action: CustomerCta;
  pricingPath: string;
  siteId: string;
}): string | null {
  if (!action || action.disabled) {
    return null;
  }
  if (action.href) {
    return action.href;
  }

  switch (action.actionId) {
    case "fix_billing":
      return pricingPath;
    case "configure_domain":
      return `/dashboard/sites/${siteId}/settings`;
    case "verify_domain":
    case "refresh_domain_status":
      return resolveFocusedDomainHref(action, siteId);
    case "review_source_selection":
      return `/dashboard/sites/${siteId}/source-selection`;
    case "start_crawl":
    case "retry_crawl":
    case "translate_and_publish":
    case "retry_translation":
      return `/dashboard/sites/${siteId}/pages`;
    case "review_quota":
      return pricingPath;
    case "view_live_site":
      return action.href ?? null;
    default:
      return null;
  }
}

function fallbackCtaLabel(action: NonNullable<CustomerCta>): string {
  if (action.actionId) {
    return formatCustomerStatusValue(action.actionId);
  }
  return "Review";
}

function resolveFocusedDomainHref(action: CustomerCta, siteId: string): string {
  const domain = typeof action?.params?.domain === "string" ? action.params.domain.trim() : "";
  const anchor = domain ? `#${domainAnchorId(domain)}` : "";
  return `/dashboard/sites/${siteId}/domains${anchor}`;
}

function domainAnchorId(domain: string): string {
  return `domain-${domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function formatActivityDescription(item: CustomerActivity): string {
  const target = item.targetLang ? item.targetLang.toUpperCase() : "all languages";
  const progress =
    item.progress?.total && typeof item.progress.completed === "number"
      ? `${item.progress.completed}/${item.progress.total}`
      : null;
  const updated = formatNullableDateTime(item.updatedAt ?? item.startedAt ?? item.finishedAt);
  return [target, progress ? `progress ${progress}` : null, `updated ${updated}`]
    .filter(Boolean)
    .join(" - ");
}

function customerBlockerKey(blocker: CustomerBlocker, index: number): string {
  return [
    blocker.area,
    blocker.code,
    blocker.severity,
    blocker.affectedDomains?.join(",") ?? "",
    blocker.affectedLangs?.join(",") ?? "",
    index,
  ].join(":");
}

function customerActivityKey(item: CustomerActivity, index: number): string {
  return [
    item.id,
    item.type,
    item.targetLang ?? "all",
    item.startedAt ?? "",
    item.updatedAt ?? "",
    item.finishedAt ?? "",
    index,
  ].join(":");
}

function describeAffectedScope(item: CustomerBlocker): string | null {
  const parts = [
    item.affectedDomains?.length ? `Domains: ${item.affectedDomains.join(", ")}` : null,
    item.affectedLangs?.length ? `Languages: ${item.affectedLangs.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : null;
}

function describeErrorScope(error: CustomerError): string | null {
  const parts = [
    error.affectedDomains?.length ? `Domains: ${error.affectedDomains.join(", ")}` : null,
    error.affectedLangs?.length ? `Languages: ${error.affectedLangs.join(", ")}` : null,
    error.affectedPaths?.length ? `Paths: ${error.affectedPaths.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : null;
}

function formatNumber(value?: number | null): string {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

function toneForSiteStatus(status: string): StatusTone {
  return status === "active" ? "success" : "neutral";
}

function toneForHealthStatus(status: SiteCustomerOverviewResponse["health"]["status"]): StatusTone {
  if (status === "healthy") return "success";
  if (status === "needs_setup" || status === "in_progress") return "info";
  if (status === "degraded") return "warning";
  if (status === "blocked") return "danger";
  return "neutral";
}

function toneForSeverity(severity: "success" | "info" | "warning" | "danger"): StatusTone {
  return severity;
}

function toneForServingStatus(
  status: SiteCustomerOverviewResponse["languages"][number]["servingStatus"]["value"],
): StatusTone {
  if (status === "live" || status === "ready") return "success";
  if (status === "needs_domain" || status === "not_configured") return "info";
  if (status === "degraded") return "warning";
  if (status === "blocked") return "danger";
  return "neutral";
}

function toneForDomainStatus(status: CustomerDomain["status"]): StatusTone {
  if (status === "verified") return "success";
  if (status === "needs_dns" || status === "pending" || status === "verifying") return "info";
  if (status === "failed") return "danger";
  return "neutral";
}

function toneForCrawlStatus(
  status: NonNullable<SiteCustomerOverviewResponse["pagesSummary"]["customerCrawlStatus"]>,
): StatusTone {
  if (status === "completed") return "success";
  if (status === "queued" || status === "in_progress" || status === "not_started") return "info";
  if (status === "failed") return "danger";
  return "neutral";
}

function toneForActivityStatus(status: CustomerActivity["customerStatus"]): StatusTone {
  if (status === "completed") return "success";
  if (status === "queued" || status === "in_progress") return "info";
  if (status === "blocked") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}
