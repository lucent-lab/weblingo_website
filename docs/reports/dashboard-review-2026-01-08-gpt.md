# Dashboard Code Review - 2026-01-08 (GPT)

## External Reviewer Context (read first)

This report is written so an external reviewer can suggest improvements without access to the codebase.

### Product context (what this dashboard is)

WebLingo is a SaaS product that crawls customer sites, translates pages, and serves localized variants.
The dashboard lets customers:
- Onboard sites and configure languages/routing.
- Verify domains and trigger crawls/translations.
- Monitor deployments and translation runs.

### Tech stack and architecture (high level)

- Frontend: Next.js (App Router) with React Server Components (RSC).
- Server actions: used for mutations (form submissions).
- Data backend: a separate Webhooks API (worker) that serves dashboard data.
- Auth: Supabase session on the dashboard app, exchanged for a Webhooks API token.
- Caching: Redis used for some server-side caches (sites list, bootstrap).

### Pipeline and operational context (from AGENTS.md in the main repo)

- Scope: deterministic HTML translation via a manifest pipeline (segment -> translate -> manifest -> render -> publish), with precedence override -> glossary -> TM -> MT, strict placeholder integrity, and idempotent apply/serve contracts.
- Architecture: Cloudflare Workers + Queues orchestrate the pipeline; Supabase is the source of truth; R2 stores snapshots/manifests/rendered HTML; KV stores deployment pointers and idempotency; serve path is DB-free and must remain so.
- Operational constraints: fail-fast config, typed contracts, no silent defaults, security gating by active sites, and one wide event per job/request with structured context.

### Key primitives referenced in findings

- `router.refresh()` (Next.js): forces re-fetch/re-render of RSC for the current route.
- Server actions: async functions invoked from forms; return an `ActionResponse` used for UI feedback.
- `listSitesCached`: server-side cached list of sites used for nav/overview.

### Glossary of domain terms (with examples)

- Crawl: a snapshot pass that discovers pages and captures HTML for translation. Example: a crawl on `example.com` finds 120 pages and stores HTML snapshots for processing.
- Translate run: a workflow run that translates snapshots for a target language. Example: a translate run for `fr` processes 120 pages and reports progress like 30/120 completed.
- Deployment: a published set of translated artifacts for a language, including a routing manifest. Example: deployment `dep_abc` is the active French version served to users.
- Serve: the edge runtime that delivers localized HTML for visitors, using the latest deployment pointer. Example: a user visits `/fr/products` and receives the rendered French page without DB access at request time.

### User journey flow map (typical)

Add site -> Configure source language + target languages -> Verify domain(s) -> Trigger crawl -> Translate run starts -> Render + publish -> Deployment becomes active -> Serve localized pages -> Monitor status and adjust settings.

### Metrics checklist (for performance suggestions)

- TTFB: measure server response time for dashboard pages; reflects RSC work plus Webhooks API latency.
- Hydration cost: measure JS size and hydration duration; indicates client component and per-row form overhead.
- Rows rendered: count table rows in pages/domains/glossary; large counts correlate with slow render and memory use.

### How to read the references

File references use the format `path:line` and refer to code locations in the local repo.
You do not need the code to understand the issues; the narrative explains the behavior.

### Scope and method

Scope: `/app/dashboard/**`, `/internal/dashboard/**`, `/components/dashboard/**` and related dashboard helpers.
Method: static code review only (no runtime profiling).

## Analyst Request Responses (verbatim artifacts, no interpretation)

This section answers the analyst’s request for exact artifacts. File paths are relative to the
`weblingo_website` repository root.

### 1) Full source: `components/dashboard/action-form.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { ActionResponse } from "@/app/dashboard/actions";
import { useActionToast } from "@internal/dashboard/use-action-toast";

type ActionFormProps = {
  action: (prevState: ActionResponse | undefined, formData: FormData) => Promise<ActionResponse>;
  loading: string;
  success: string;
  error: string;
  confirmMessage?: string;
  className?: string;
  onSuccess?: (state: ActionResponse) => void;
  children: ReactNode;
};

const initialState: ActionResponse = { ok: false, message: "" };

export function ActionForm({
  action,
  loading,
  success,
  error,
  confirmMessage,
  className,
  onSuccess,
  children,
}: ActionFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading,
    success,
    error,
  });
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      const redirectTo =
        typeof state.meta?.redirectTo === "string" ? state.meta.redirectTo : null;
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
      onSuccess?.(state);
    }
    wasPending.current = pending;
  }, [pending, state, router, onSuccess]);

  return (
    <form
      action={submitWithToast}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
```

### 2) `ActionResponse` type definition + example payload

Source: `app/dashboard/actions.ts`.

```ts
export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};
```

Example payload (returned by `deleteSiteAction`):

```json
{
  "ok": true,
  "message": "Site deleted.",
  "meta": { "redirectTo": "/dashboard/sites" }
}
```

### 3) Representative page with per-row actions

Source: `app/dashboard/sites/[id]/pages/page.tsx`.

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { triggerPageCrawlAction } from "../../../actions";

import { ActionForm } from "@/components/dashboard/action-form";
import { SiteHeader } from "../site-header";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchDeployments,
  fetchSite,
  fetchSitePages,
  WebhooksApiError,
  type Deployment,
  type Site,
  type SitePageSummary,
} from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Site pages",
  robots: { index: false, follow: false },
};

type SitePagesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    toast?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SitePagesPage({ params, searchParams }: SitePagesPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const toastMessage = decodeSearchParam(resolvedSearchParams?.toast);
  const actionErrorMessage = decodeSearchParam(resolvedSearchParams?.error);
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");
  const servingTitle = t("dashboard.serving.languages.title");
  const servingDescription = t("dashboard.serving.languages.description");
  const servingLanguageLabel = t("dashboard.serving.languages.columns.language");
  const servingDomainLabel = t("dashboard.serving.languages.columns.domain");
  const servingStatusLabel = t("dashboard.serving.languages.columns.serving");
  const servingActiveLabel = t("dashboard.deployments.activeId.label");
  const deploymentsEmpty = t("dashboard.deployments.empty");
  const crawlSummaryTitle = t("dashboard.crawl.summary.title");
  const crawlSummaryDescription = t("dashboard.crawl.summary.description");
  const crawlSummaryEmpty = t("dashboard.crawl.summary.empty");
  const crawlStatusLabel = t("dashboard.crawl.summary.status");
  const crawlTriggerLabel = t("dashboard.crawl.summary.trigger");
  const crawlCaptureModeLabel = t("dashboard.crawl.summary.captureMode");
  const crawlStartedLabel = t("dashboard.crawl.summary.startedAt");
  const crawlFinishedLabel = t("dashboard.crawl.summary.finishedAt");
  const crawlDiscoveredLabel = t("dashboard.crawl.summary.discovered");
  const crawlEnqueuedLabel = t("dashboard.crawl.summary.enqueued");
  const crawlSelectedLabel = t("dashboard.crawl.summary.selected");
  const crawlSkippedLabel = t("dashboard.crawl.summary.skippedDueToLimit");
  const crawlErrorLabel = t("dashboard.crawl.summary.error");
  const pageNextCrawlLabel = t("dashboard.pages.columns.nextCrawl");
  const eligibleNowLabel = t("dashboard.pages.eligibleNow");
  const servingStatusLabels = {
    inactive: t("dashboard.serving.status.inactive"),
    disabled: t("dashboard.serving.status.disabled"),
    needs_domain: t("dashboard.serving.status.needsDomain"),
    ready: t("dashboard.serving.status.ready"),
    serving: t("dashboard.serving.status.serving"),
  };
  const crawlStatusLabels = {
    in_progress: t("dashboard.crawl.status.inProgress"),
    completed: t("dashboard.crawl.status.completed"),
    failed: t("dashboard.crawl.status.failed"),
  };
  const crawlTriggerLabels = {
    cron: t("dashboard.crawl.trigger.cron"),
    queue: t("dashboard.crawl.trigger.queue"),
  };

  let site: Site | null = null;
  let pages: SitePageSummary[] = [];
  let deployments: Deployment[] = [];
  let error: string | null = null;

  const [siteResult, pagesResult, deploymentsResult] = await Promise.allSettled([
    fetchSite(authToken, id),
    fetchSitePages(authToken, id),
    fetchDeployments(authToken, id),
  ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    const err = siteResult.reason;
    error = err instanceof Error ? err.message : "Unable to load site pages.";
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSite failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSite failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (pagesResult.status === "fulfilled") {
    pages = pagesResult.value;
  } else {
    const err = pagesResult.reason;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSitePages failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      const message = err instanceof Error ? err.message : "Unable to load site pages.";
      console.warn("[dashboard] fetchSitePages failed (unknown error)", {
        siteId: id,
        message,
      });
    }
  }

  if (deploymentsResult.status === "fulfilled") {
    deployments = deploymentsResult.value;
  } else {
    console.warn("[dashboard] fetchDeployments failed:", deploymentsResult.reason);
  }

  if (!site) {
    if (error) {
      return (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load site</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline" href="/dashboard/sites">
              Back to sites
            </Link>
          </CardContent>
        </Card>
      );
    }
    notFound();
  }

  const dailyUsage = auth.account?.dailyCrawlUsage;
  const maxDailyPageCrawls = auth.account?.featureFlags.maxDailyPageRecrawls ?? null;
  const pageCrawlLimitReached =
    maxDailyPageCrawls !== null && (dailyUsage?.pageCrawls ?? 0) >= maxDailyPageCrawls;
  const crawlReady = site.status === "active";
  const returnTo = `/dashboard/sites/${site.id}/pages`;
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const deploymentsByLang = new Map(
    deployments.map((deployment) => [deployment.targetLang, deployment]),
  );
  const latestCrawlRun = site.latestCrawlRun ?? null;
  const servingRows = targetLangs
    .map((lang) => deploymentsByLang.get(lang))
    .filter((deployment): deployment is Deployment => Boolean(deployment));

  return (
    <div className="space-y-8">
      {actionErrorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionErrorMessage}{" "}
          <Link className="font-medium underline" href={returnTo}>
            Dismiss
          </Link>
        </div>
      ) : toastMessage ? (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {toastMessage}{" "}
          <Link className="font-medium underline" href={returnTo}>
            Dismiss
          </Link>
        </div>
      ) : null}

      <SiteHeader
        site={site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        deactivateLabel={deactivateLabel}
        reactivateLabel={reactivateLabel}
        deactivateConfirm={deactivateConfirm}
        activateHelpLabel={activateHelpLabel}
        activateHelp={activateHelp}
      />

      <Card>
        <CardHeader>
          <CardTitle>{crawlSummaryTitle}</CardTitle>
          <CardDescription>{crawlSummaryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {!latestCrawlRun ? (
            <p className="text-sm text-muted-foreground">{crawlSummaryEmpty}</p>
          ) : (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlStatusLabel}</div>
                <Badge variant={resolveCrawlStatusVariant(latestCrawlRun.status)}>
                  {crawlStatusLabels[latestCrawlRun.status] ?? latestCrawlRun.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlTriggerLabel}</div>
                <span className="font-mono text-foreground">
                  {crawlTriggerLabels[latestCrawlRun.trigger] ?? latestCrawlRun.trigger}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">
                  {crawlCaptureModeLabel}
                </div>
                <span className="font-mono text-foreground">
                  {latestCrawlRun.crawlCaptureMode ?? "—"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlStartedLabel}</div>
                <span className="text-muted-foreground">
                  {formatTimestamp(latestCrawlRun.startedAt)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlFinishedLabel}</div>
                <span className="text-muted-foreground">
                  {formatTimestamp(latestCrawlRun.finishedAt)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">
                  {crawlDiscoveredLabel}
                </div>
                <span className="font-mono text-foreground">{latestCrawlRun.pagesDiscovered}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlEnqueuedLabel}</div>
                <span className="font-mono text-foreground">{latestCrawlRun.pagesEnqueued}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlSelectedLabel}</div>
                <span className="font-mono text-foreground">{latestCrawlRun.selectedCount}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlSkippedLabel}</div>
                <span className="font-mono text-foreground">
                  {latestCrawlRun.skippedDueToLimitCount}
                </span>
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase text-muted-foreground">{crawlErrorLabel}</div>
                <span
                  className={latestCrawlRun.error ? "text-destructive" : "text-muted-foreground"}
                >
                  {latestCrawlRun.error ?? "—"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{servingTitle}</CardTitle>
          <CardDescription>{servingDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {servingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{deploymentsEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{servingLanguageLabel}</th>
                    <th className="px-3 py-2 text-left">{servingDomainLabel}</th>
                    <th className="px-3 py-2 text-left">{servingStatusLabel}</th>
                    <th className="px-3 py-2 text-left">{servingActiveLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {servingRows.map((deployment) => {
                    const domainStatus = deployment.domainStatus ?? null;
                    const servingLabel =
                      servingStatusLabels[deployment.servingStatus] ?? deployment.servingStatus;
                    const servingVariant = resolveServingStatusVariant(deployment.servingStatus);
                    const domainVariant = resolveDomainStatusVariant(domainStatus);
                    return (
                      <tr
                        key={`${deployment.targetLang}-${deployment.domain ?? "domain"}`}
                        className="border-t border-border/50"
                      >
                        <td className="px-3 py-3 align-top font-semibold text-foreground">
                          {deployment.targetLang.toUpperCase()}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-foreground">{deployment.domain ?? "—"}</span>
                            {domainStatus ? (
                              <Badge variant={domainVariant}>{domainStatus}</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge variant={servingVariant}>{servingLabel}</Badge>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={
                              deployment.activeDeploymentId
                                ? "font-mono text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {deployment.activeDeploymentId ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Discovered pages from sitemaps and crawls. Enable localization before triggering a new
            crawl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pages discovered yet. We will seed from sitemaps after onboarding, then refresh
              once localization is enabled.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Page</th>
                    <th className="px-3 py-2 text-left">Last crawl</th>
                    <th className="px-3 py-2 text-left">Last change</th>
                    <th className="px-3 py-2 text-left">{pageNextCrawlLabel}</th>
                    {canCrawl ? <th className="px-3 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id} className="border-t border-border/50">
                      <td className="px-3 py-3 align-top">
                        <span className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                          {page.sourcePath}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatTimestamp(page.lastCrawledAt)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatTimestamp(page.lastSnapshotAt)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatNextCrawlAt(page.nextCrawlAt, eligibleNowLabel)}
                      </td>
                      {canCrawl ? (
                        <td className="px-3 py-3 text-right align-top">
                          <ActionForm
                            action={triggerPageCrawlAction}
                            loading="Starting page crawl..."
                            success="Page crawl enqueued."
                            error="Unable to enqueue page crawl."
                          >
                            <>
                              <input name="siteId" type="hidden" value={site.id} />
                              <input name="pageId" type="hidden" value={page.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                disabled={!crawlReady || pageCrawlLimitReached}
                                title={
                                  pageCrawlLimitReached
                                    ? "Daily page crawl limit reached."
                                    : crawlReady
                                      ? "Enqueue a crawl for this page."
                                      : "Enable localization to crawl."
                                }
                              >
                                Force crawl
                              </Button>
                            </>
                          </ActionForm>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function decodeSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString();
}

function formatNextCrawlAt(value: string | null | undefined, eligibleNowLabel: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  if (date.getTime() <= Date.now()) {
    return eligibleNowLabel;
  }
  return formatTimestamp(value);
}

function resolveServingStatusVariant(status: Deployment["servingStatus"]) {
  switch (status) {
    case "serving":
      return "default";
    case "ready":
      return "secondary";
    case "disabled":
    case "needs_domain":
    case "inactive":
    default:
      return "outline";
  }
}

function resolveCrawlStatusVariant(status: "in_progress" | "completed" | "failed") {
  switch (status) {
    case "completed":
      return "secondary";
    case "failed":
      return "destructive";
    case "in_progress":
    default:
      return "outline";
  }
}

function resolveDomainStatusVariant(status: Deployment["domainStatus"] | null) {
  switch (status) {
    case "verified":
      return "secondary";
    case "failed":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
}
```

### 4) Current API contract for pages listing (`fetchSitePages`)

Client call site (dashboard): `internal/dashboard/webhooks.ts`.

Request:
- Method: `GET`
- Path: `/sites/{siteId}/pages`
- Query params: none

Response schema (dashboard):

```ts
const listSitePagesResponseSchema = z
  .object({
    pages: z.array(
      z.object({
        id: z.string(),
        sourcePath: z.string(),
        lastSeenAt: z.string().nullable().optional(),
        lastCrawledAt: z.string().nullable().optional(),
        lastSnapshotAt: z.string().nullable().optional(),
        nextCrawlAt: z.string().nullable().optional(),
        lastVersionAt: z.string().nullable().optional(),
      }),
    ),
  })
  .strict();
```

Server handler (webhooks worker in main repo): `workers/webhooks-worker/src/handlers/sites.ts:listPages`.

Notes from handler:
- Supabase query uses `order=last_seen_at.desc`.
- No `limit` or `offset` is set.
- All pages for the site are returned.

Max size:
- No max size or p95 value is defined in code or config.

### 5) Typical scale numbers (p95)

No p95 numbers are defined in code or config. The only p95 values in this repository are estimates
in the LLM report `docs/reports/dashboard-review-2026-01-08-gemini.md:165-167`:

- Pages per site (p95): `500–1,000`
- Domains per site (p95): `2–5`
- Glossary entries per site (p95): `200–500`

### 6) SWR / React Query dependencies

The dashboard app `package.json` (repo root: `weblingo_website/package.json`) lists neither `swr`
nor `@tanstack/react-query` in `dependencies` or `devDependencies`.

## Analyst Response Update (2026-01-08)

### Coherence check (confirmed in repo, no interpretation)

- `ActionForm` source code is identical to the version already included above and includes implicit
  `router.refresh()` for successful actions without `meta.redirectTo`.
- `ActionResponse` is the type already included above:
  `{ ok: boolean; message: string; meta?: Record<string, unknown> }`.
- The per-row `ActionForm` pattern is present in `app/dashboard/sites/[id]/pages/page.tsx`
  (see full source above).
- `fetchSitePages` is unpaginated with a strict response schema
  (`GET /sites/{siteId}/pages` -> `{ pages: SitePageSummary[] }`) and no limit/offset in the
  handler (`workers/webhooks-worker/src/handlers/sites.ts:listPages`).
- Dependencies for implementation constraints: `sonner` is in `weblingo_website/package.json`;
  neither `swr` nor `@tanstack/react-query` is present in `dependencies` or `devDependencies`.

### Uncertainties resolved by repo state (no interpretation)

- Next.js version: `weblingo_website/package.json` has `"next": "16.1.1"`.
- p95 scale numbers: not defined in code/config; only estimates appear in
  `docs/reports/dashboard-review-2026-01-08-gemini.md:165-167`.

## Analyst Updated Implementation Spec (verbatim)

## 1) Coherence check of the 3 updated reports

### What is now coherent (✅ strongly consistent across reports)

**A) `ActionForm` source code is identical in GPT + Gemini**
Both provide the same `components/dashboard/action-form.tsx` implementation, including the **implicit** `router.refresh()` for any successful action without `meta.redirectTo`.  

**B) `ActionResponse` is consistent**
All describe the same type:

```ts
export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};
```

This is important because it means we can safely add **additional meta keys** (e.g. `meta.refresh`) without breaking type compatibility.  

**C) The “per-row `ActionForm` in a big table” pattern is confirmed with a real file**
The `app/dashboard/sites/[id]/pages/page.tsx` example shows **N rows ⇒ N ActionForm instances**, each with `useActionState`, `useEffect`, `useRouter`, and toast wiring.  

**D) `fetchSitePages` contract is confirmed and is currently unpaginated**
Dashboard wrapper:

* `GET /sites/{siteId}/pages`
* response: `{ pages: SitePageSummary[] }` (strict schema)
  No limit/offset/cursor currently exposed by the wrapper.  

**E) Dependencies are coherent for implementation constraints**
All agree: **no SWR / no React Query installed**, and **`sonner` is present** for toasts. That heavily influences “how” we should implement granular updates and polling.  

---

### Where they are NOT coherent (⚠️ treat as uncertain)

**1) Next.js major version**

* One report claims Next.js 15 (likely assumption). 
* Another report shows a concrete `package.json` snippet with `next: "16.1.1"`. 

**Action for Codex:** treat the `package.json` value as source-of-truth during implementation (Codex can read the repo), and do not rely on the “Next 15” statement.

**2) Scale / p95 numbers**
The reports explicitly admit they’re estimates and they disagree (200 vs 500–1000 pages p95).  
**Action for Codex:** implement pagination + avoid per-row client forms regardless of scale; those fixes are correct even at 100 pages.

---

## 2) Updated Codex Implementation Spec (very explicit)

This is the **complete, codex-ready plan** based on the now-confirmed code artifacts. It is written to avoid interpretation.

---

# Phase P0 — Remove unnecessary full route refreshes and URL-based “dismiss” reloads

## P0.1 Refactor `ActionForm` to make refresh explicit (backwards compatible)

### Why

Current `ActionForm` always calls `router.refresh()` on success (unless `meta.redirectTo`), causing:

* full RSC re-execution
* re-fetch of `fetchSitePages` (potentially huge)
* scroll/focus reset and jank
  Confirmed in `components/dashboard/action-form.tsx`. 

### Exact change

**File:** `components/dashboard/action-form.tsx` 

1. **Add a new optional prop** to `ActionFormProps`:

```ts
refreshOnSuccess?: boolean;
```

2. **Modify success handling** so refresh is conditional.

**Rules (MUST implement exactly):**

* If `state.meta.redirectTo` is a string ⇒ `router.push(redirectTo)` and **do not refresh**
* Else determine `shouldRefresh`:

  * If prop `refreshOnSuccess` is provided ⇒ use it
  * Else if `state.meta.refresh` is boolean ⇒ use it
  * Else default ⇒ `true` (to keep current behavior until call sites are migrated)

3. **Call `onSuccess` before navigation** (so it still runs even if push causes unmount).

### Codex-ready patch (replace the body of the effect)

```tsx
useEffect(() => {
  if (wasPending.current && !pending && state.ok) {
    onSuccess?.(state);

    const redirectTo =
      typeof state.meta?.redirectTo === "string" ? (state.meta.redirectTo as string) : null;

    if (redirectTo) {
      router.push(redirectTo);
      wasPending.current = pending;
      return;
    }

    const metaRefresh =
      typeof state.meta?.refresh === "boolean" ? (state.meta.refresh as boolean) : undefined;

    const shouldRefresh = refreshOnSuccess ?? metaRefresh ?? true;

    if (shouldRefresh) {
      router.refresh();
    }
  }

  wasPending.current = pending;
}, [pending, state, router, onSuccess, refreshOnSuccess]);
```

**Also update the component signature to accept `refreshOnSuccess`:**

```ts
export function ActionForm({ ..., refreshOnSuccess, ... }: ActionFormProps) { ... }
```

### Acceptance criteria

* Existing call sites behave the same **without changes** (still refreshes).
* Any call site can opt out via `refreshOnSuccess={false}`.
* Any action can opt out via returning `meta: { refresh: false }`.

---

## P0.2 Stop the “Pages” table from forcing full refresh on per-row “Force crawl”

### Why

`app/dashboard/sites/[id]/pages/page.tsx` currently renders an `ActionForm` per row and every success triggers `router.refresh()` ⇒ re-fetches the entire table payload and re-renders the whole page. 

### Exact change

**File:** `app/dashboard/sites/[id]/pages/page.tsx` 

Find the row action:

```tsx
<ActionForm
  action={triggerPageCrawlAction}
  loading="Starting page crawl..."
  success="Page crawl enqueued."
  error="Unable to enqueue page crawl."
>
```

Change it to:

```tsx
<ActionForm
  action={triggerPageCrawlAction}
  loading="Starting page crawl..."
  success="Page crawl enqueued."
  error="Unable to enqueue page crawl."
  refreshOnSuccess={false}
>
```

### Acceptance criteria

* Clicking “Force crawl” shows the toast (from `useActionToast`) and **does not** re-render the entire route.
* No URL change.
* No scroll reset.

---

## P0.3 Remove URL-based toast/error banners + “Dismiss” links that reload the page

### Why

The Pages screen parses `searchParams.toast` / `searchParams.error` and renders a banner with a **Dismiss Link** that navigates (reloads the page). This is explicitly shown in the provided file. 

### Exact change (minimum)

**File:** `app/dashboard/sites/[id]/pages/page.tsx` 

1. Delete this whole block in the returned JSX:

```tsx
{actionErrorMessage ? ( ... Dismiss Link ... ) : toastMessage ? ( ... Dismiss Link ... ) : null}
```

2. Remove the related variables:

* `resolvedSearchParams`
* `toastMessage`
* `actionErrorMessage`
* `returnTo`

3. Remove the `decodeSearchParam` function at bottom (if it becomes unused in this file).

4. Update the `SitePagesPageProps` type to remove `toast`/`error` if no longer used in the file.

### Repo-wide follow-up (MUST do)

Search and delete this pattern everywhere:

* `decodeSearchParam(resolvedSearchParams?.toast)`
* `decodeSearchParam(resolvedSearchParams?.error)`
* `?toast=`
* `?error=`
* “Dismiss” `<Link ... href={returnTo}>Dismiss</Link>`

The reports list multiple pages with duplication:
`sites/[id]/page.tsx`, `sites/[id]/admin/page.tsx`, `sites/[id]/overrides/page.tsx`, `sites/[id]/pages/page.tsx`.  

### Acceptance criteria

* Success/error feedback is exclusively shown by `sonner` toasts from `useActionToast`.
* Dismissing notifications never triggers navigation.

---

# Phase P1 — Pagination for pages (fix scalability + reduce TTFB payload)

## P1.1 Add pagination parameters to the Webhooks API “list pages” endpoint

### Constraint (critical)

Dashboard schema currently validates the response **strictly** as:

```ts
z.object({ pages: z.array(sitePageSummarySchema) }).strict()
```

So **the backend MUST continue returning exactly `{ pages: [...] }`**.
(Adding extra keys would break strict decoding.)

### Backend change

**Webhooks worker handler** (as referenced by the reports): implement query params:

* `limit` (integer)
* `offset` (integer)

Behavior:

* Default `limit = 50`, default `offset = 0`
* Clamp `limit` to `[1, 200]`
* Use Supabase `.range(offset, offset + limit - 1)`
  Ordering stays `last_seen_at.desc` (and also add a stable secondary order on `id.desc` if available).

Result shape remains:

```json
{ "pages": [ ... ] }
```

This satisfies current strict schema. 

---

## P1.2 Update dashboard `fetchSitePages` wrapper to accept pagination

**File:** `internal/dashboard/webhooks.ts` 

Change function signature from:

```ts
fetchSitePages(auth, siteId): Promise<SitePageSummary[]>
```

to:

```ts
export async function fetchSitePages(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SitePageSummary[]> { ... }
```

Implementation (Codex-ready):

```ts
export async function fetchSitePages(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SitePageSummary[]> {
  const qs = new URLSearchParams();
  if (typeof options?.limit === "number") qs.set("limit", String(options.limit));
  if (typeof options?.offset === "number") qs.set("offset", String(options.offset));

  const path = qs.size
    ? `/sites/${siteId}/pages?${qs.toString()}`
    : `/sites/${siteId}/pages`;

  const data = await request({
    path,
    auth,
    schema: listSitePagesResponseSchema,
  });

  return data.pages;
}
```

---

## P1.3 Update `SitePagesPage` UI to paginate via search params (shareable state)

**File:** `app/dashboard/sites/[id]/pages/page.tsx` 

### Required UI behavior

* Default: show **50** rows per page.
* Use query param `page` (1-indexed).
* Determine `hasNextPage` without changing backend response shape:

  * request `limit + 1`
  * if response length > limit ⇒ hasNextPage = true
  * display only first `limit` rows

### Codex-ready logic (server component)

At the top, parse page:

```ts
const resolvedSearchParams = await searchParams;
const pageParam = Array.isArray(resolvedSearchParams?.page)
  ? resolvedSearchParams?.page[0]
  : resolvedSearchParams?.page;

const pageNumber = Math.max(1, Number(pageParam ?? "1") || 1);

const pageSize = 50;
const offset = (pageNumber - 1) * pageSize;

// request one extra row
const requestedLimit = pageSize + 1;
```

When fetch pages:

```ts
fetchSitePages(authToken, id, { limit: requestedLimit, offset })
```

After fetch:

```ts
const hasNextPage = pages.length > pageSize;
const visiblePages = hasNextPage ? pages.slice(0, pageSize) : pages;
```

Render table using `visiblePages`.

Render pager controls at bottom:

* Previous link if pageNumber > 1
* Next link if hasNextPage

Links MUST preserve the base route and set `?page=N` only.

### Acceptance criteria

* A site with 1000 pages does not render 1000 rows.
* Initial payload size stays bounded.
* Navigation between pages does not rely on `router.refresh()`.

---

# Phase P2 — Fix long-running job UX (polling without adding dependencies)

## P2.1 Add dashboard API route proxy for job status (no SWR/React Query)

Because the dashboard is server-rendered and webhooks auth is server-only, the clean approach is:

* Client polls a dashboard API route
* API route uses `requireDashboardAuth()` and calls the Webhooks API

This is aligned with the reports’ “polling mechanism” recommendation.  

### Minimal viable endpoint

Create:

`app/api/dashboard/sites/[siteId]/status/route.ts`

Response includes only what UI needs for “live status”, e.g.:

* latest crawl run status fields
* latest translate run status fields (if available)
* deployments summary (optional)

### Client hook

Create a client hook:

`internal/dashboard/use-poll.ts` (or similar)

* Poll every 3 seconds while status is “in_progress/running”
* Stop polling on terminal states

### UI integration

Convert only the “status summary” cards (crawl/translate) into client components that:

* receive initial server data as props
* poll and update text/badges in place

This lets you later disable refresh for actions like `triggerCrawlAction` and `translateAndServeAction` safely.

---

# Phase P3 — Data correctness: cache invalidation + reduce over-broad revalidation

## P3.1 Ensure `invalidateSitesCache` is called for any mutation that changes sidebar-visible site state

Reports indicate mismatches where TTL-based Redis cache causes stale sidebar/overview until expiration.  

**Codex MUST:**

* Identify actions that affect:

  * site status (active/inactive)
  * domain verification/provisioning status
  * serving status
  * site creation/deletion
* Ensure they call `invalidateSitesCache(auth.webhooksAuth)`.

---

# Phase P4 — Maintainability / duplication cleanup (safe refactors after P0–P2)

## P4.1 Extract duplicated formatting + badge variant helpers

Reports identify duplicates of:

* `decodeSearchParam`
* `formatTimestamp`
* status→variant functions
  across multiple pages.  

Create:

* `internal/dashboard/format.ts`

  * `formatTimestamp(value?: string | null): string`
  * `formatNextCrawlAt(value: string | null | undefined, eligibleNowLabel: string): string`
* `internal/dashboard/status.ts`

  * `resolveServingStatusVariant(...)`
  * `resolveCrawlStatusVariant(...)`
  * `resolveDomainStatusVariant(...)`

Then replace inline duplicates with imports.

---

## P4.2 Split `app/dashboard/actions.ts` by domain (optional but recommended)

All three reports agree it is too large and repetitive.   

Target structure:

* `app/dashboard/actions/index.ts` (re-export for backwards compatibility)
* `app/dashboard/actions/sites.ts`
* `app/dashboard/actions/domains.ts`
* `app/dashboard/actions/crawl.ts`
* `app/dashboard/actions/translation.ts`
* `app/dashboard/actions/glossary.ts`
* `app/dashboard/actions/_utils.ts`

---

## 3) What these updated reports enabled vs my previous report

The updated reports removed the remaining ambiguity around:

* the exact `ActionForm` behavior (`router.refresh()` is real and unconditional) 
* the strict `ActionResponse` contract (`meta` is flexible and safe for new flags) 
* the exact “big table + per-row ActionForm” implementation (`sites/[id]/pages/page.tsx`) 
* the exact `fetchSitePages` schema and why backend response shape must not change casually (`.strict()`) 

That let me write the pagination plan in a way that **does not break** your strict schema consumers.

---

## 4) Recommended implementation order for Codex (to minimize risk)

1. **P0.1** Add `refreshOnSuccess` + `meta.refresh` support to ActionForm (default keep behavior).
2. **P0.2** Set `refreshOnSuccess={false}` for per-row “Force crawl”.
3. **P0.3** Delete URL-based toast/error banners + dismiss links.
4. **P1** Implement `limit/offset` in backend + wrapper + pages UI pagination.
5. **P2** Add polling for crawl/translation status, then selectively disable refresh for async actions.
6. **P3/P4** Cache invalidation + refactors.

If you want, I can also produce a **“repo grep checklist”** (exact search queries and which files to change) so Codex can mechanically apply these across the codebase with low judgment.

## Implementation Plan (Milestones & Atomic Tasks)

Each task is a single, unambiguous edit and is tracked with a checkbox.

### Milestone P0 — Refresh behavior + toast cleanup

- [ ] `weblingo_website/components/dashboard/action-form.tsx`: add `refreshOnSuccess?: boolean` to `ActionFormProps`.
- [ ] `weblingo_website/components/dashboard/action-form.tsx`: update `ActionForm` signature to accept `refreshOnSuccess`.
- [ ] `weblingo_website/components/dashboard/action-form.tsx`: replace the entire `useEffect` body with the exact snippet in **P0.1** above (the block that computes `shouldRefresh` and calls `router.refresh()` conditionally).
- [ ] `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`: add `refreshOnSuccess={false}` to the “Force crawl” `<ActionForm>` (the one that calls `triggerPageCrawlAction`).
- [ ] `weblingo_website/components/dashboard/flash-toasts.tsx`: create a new client component that:
  - reads `toast`, `error`, and `details` from `useSearchParams()`,
  - calls `toast.success(message)` for `toast`,
  - calls `toast.error(message, { description })` for `error` + `details`,
  - calls `router.replace(pathname)` to remove those params after firing toasts.
- [ ] `weblingo_website/app/dashboard/layout.tsx`: render `<FlashToasts />` once at the dashboard root (inside the `SidebarProvider` tree).
- [ ] `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`: remove URL banner JSX block that renders `Dismiss` links and remove:
  - `resolvedSearchParams`, `toastMessage`, `actionErrorMessage`, `returnTo`,
  - `decodeSearchParam` helper,
  - `toast`/`error` fields from `SitePagesPageProps` if no longer used.
- [ ] `weblingo_website/app/dashboard/sites/[id]/page.tsx`: remove URL banner JSX block and remove:
  - `resolvedSearchParams`, `toastMessage`, `actionErrorMessage`, `actionErrorDetails`,
  - `decodeSearchParam` helper,
  - `toast`/`error`/`details` fields from `SitePageProps` if no longer used.
- [ ] `weblingo_website/app/dashboard/sites/[id]/admin/page.tsx`: remove URL banner JSX block and any `decodeSearchParam` usage; remove `toast`/`error` search params from props if unused.
- [ ] `weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx`: remove URL banner JSX block and any `decodeSearchParam` usage; remove `toast`/`error` search params from props if unused.

### Milestone P1 — Pages pagination (backend + wrapper + UI)

- [ ] `weblingo/workers/webhooks-worker/src/handlers/sites.ts` (main repo): in `listPages`, parse `limit` and `offset` query params from the request URL; defaults: `limit=50`, `offset=0`; clamp `limit` to `1..200`, clamp `offset` to `>=0`.
- [ ] `weblingo/workers/webhooks-worker/src/handlers/sites.ts`: in `listPages`, set `pagesUrl.searchParams.set("limit", String(limit))` and `pagesUrl.searchParams.set("offset", String(offset))`.
- [ ] `weblingo/workers/webhooks-worker/src/handlers/sites.ts`: change `order` to `last_seen_at.desc,id.desc` so pagination order is stable.
- [ ] `weblingo_website/internal/dashboard/webhooks.ts`: change `fetchSitePages` signature to accept `options?: { limit?: number; offset?: number }` and return `data.pages` (not the full response object).
- [ ] `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`: parse `page` search param (1-indexed), compute `pageSize=50`, `offset`, and `requestedLimit=pageSize+1`.
- [ ] `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`: call `fetchSitePages(authToken, id, { limit: requestedLimit, offset })`, compute `hasNextPage` and `visiblePages`, and render the table using `visiblePages`.
- [ ] `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`: add Prev/Next pagination links below the pages table using `?page=<n>` (Prev only when `pageNumber > 1`, Next only when `hasNextPage` is true).

### Milestone P2 — Live status polling (no new deps)

- [ ] `weblingo_website/app/api/dashboard/sites/[siteId]/status/route.ts`: create a new route that:
  - calls `requireDashboardAuth()` to get `webhooksAuth`,
  - calls `fetchSite(auth.webhooksAuth, siteId)` and `fetchDeployments(auth.webhooksAuth, siteId)`,
  - returns JSON `{ latestCrawlRun: site.latestCrawlRun ?? null, deployments }`.
- [ ] `weblingo_website/internal/dashboard/use-poll.ts`: create `useSiteStatusPoll` with signature:
  - input: `{ siteId: string; enabled?: boolean }`,
  - output: `{ data: { latestCrawlRun: Site["latestCrawlRun"] | null; deployments: Deployment[] } | null; error: Error | null; isPolling: boolean }`,
  - poll interval: 3000ms while enabled,
  - stop polling when `latestCrawlRun?.status !== "in_progress"` **and** all `deployment.translationRun?.status` are not `"queued"` or `"in_progress"`.
- [ ] `weblingo_website/app/dashboard/sites/[id]/status-cards.tsx`: create a client component that receives `siteId`, `initialLatestCrawlRun`, and `initialDeployments`, renders the existing crawl/translation status cards, and replaces them with polled data when `useSiteStatusPoll` updates.
- [ ] `weblingo_website/app/dashboard/sites/[id]/page.tsx`: replace the existing crawl/translation status card JSX with `<SiteStatusCards siteId={site.id} initialLatestCrawlRun={site.latestCrawlRun ?? null} initialDeployments={deployments} />` and remove any duplicate rendering of those cards in this file.

### Milestone P3 — Cache invalidation for sidebar correctness

- [ ] `weblingo_website/app/dashboard/actions.ts`: in `verifyDomainAction`, wrap `verifyDomain(...)` inside `withWebhooksAuth(async (auth) => { ... })` and call `await invalidateSitesCache(auth)` before returning from the callback.
- [ ] `weblingo_website/app/dashboard/actions.ts`: in `provisionDomainAction`, wrap `provisionDomain(...)` inside `withWebhooksAuth(async (auth) => { ... })` and call `await invalidateSitesCache(auth)` before returning from the callback.
- [ ] `weblingo_website/app/dashboard/actions.ts`: in `refreshDomainAction`, wrap `refreshDomain(...)` inside `withWebhooksAuth(async (auth) => { ... })` and call `await invalidateSitesCache(auth)` before returning from the callback.
- [ ] `weblingo_website/app/dashboard/actions.ts`: in `setLocaleServingAction`, change the `withWebhooksAuth` call to include `await invalidateSitesCache(auth)` after `setLocaleServing(...)` and before returning.

### Milestone P4 — Optional cleanups (post-P0–P2)

- [ ] `weblingo_website/app/dashboard/sites/[id]/glossary-editor.tsx`: remove `useMemo(() => JSON.stringify(entries), [entries])` and stop binding `value={serialized}`.
- [ ] `weblingo_website/app/dashboard/sites/[id]/glossary-editor.tsx`: add a `ref` to the hidden `<input name="entries">` and set its value to `JSON.stringify(entries)` inside the form `onSubmit` handler before submission.
- [ ] `weblingo_website/app/dashboard/layout.tsx`: fetch `const sites = await listSitesCached(auth.webhooksAuth!)` once and pass `sites` to `<SitesNavSection>` and `<SitesUsageSummary>`.
- [ ] `weblingo_website/app/dashboard/layout.tsx`: update `SitesNavSection` to accept `{ sites }` and remove its internal `listSitesCached` call.
- [ ] `weblingo_website/app/dashboard/layout.tsx`: update `SitesUsageSummary` to accept `{ sites }` and remove its internal `listSitesCached` call (use `sites` to compute active site count when not agency summary).
- [ ] `weblingo_website/internal/dashboard/format.ts`: create helpers `formatTimestamp` and `formatNextCrawlAt` using the exact logic currently in `app/dashboard/sites/[id]/pages/page.tsx`.
- [ ] `weblingo_website/internal/dashboard/status.ts`: create helpers `resolveServingStatusVariant`, `resolveCrawlStatusVariant`, `resolveDomainStatusVariant` using the exact logic currently in `app/dashboard/sites/[id]/pages/page.tsx`.
- [ ] Replace local helper implementations with imports in:
  - `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`
  - `weblingo_website/app/dashboard/sites/[id]/page.tsx`
  - `weblingo_website/app/dashboard/sites/[id]/admin/page.tsx`
  - `weblingo_website/app/dashboard/ops/page.tsx`

## Findings (ordered by severity)

### Critical 1 - Full route refresh after every dashboard action

Evidence:
- `components/dashboard/action-form.tsx:45-53`

Narrative:
ActionForm triggers `router.refresh()` for any successful action that does not include `redirectTo`. Nearly every dashboard action uses this component (site status, domain verify, translation runs, page crawl). This forces a full RSC refresh, re-fetching all data and re-rendering layout/page. It resets scroll, focus, and in-progress UI. This is the most likely cause of the "page reloads when not required" complaint.

Impact:
The UI feels janky after every action, and the app pays the full data-fetching cost each time.

Recommendation:
Replace `router.refresh()` with targeted client state updates, or allow ActionForm callers to opt out. Return updated data from actions and update local state, or use SWR/React Query + mutate on specific resources.

### High 2 - Client-heavy action forms inside large lists

Evidence:
- `app/dashboard/sites/[id]/page.tsx:558-713`
- `app/dashboard/sites/[id]/pages/page.tsx:391-434`

Narrative:
Each domain row and each page row renders its own ActionForm, which includes `useActionState`, `useEffect`, and toast wiring. On sites with many pages or domains, this grows the client component tree linearly and increases hydration time and memory usage. Combined with full refreshes, this magnifies the cost of every interaction.

Impact:
Slow initial render, slow interactions, and high memory usage on large sites.

Recommendation:
Use a shared client handler for row actions (one `useActionState` per table), or replace row actions with a minimal client wrapper that delegates to a single action dispatcher. Add pagination or virtualization for large lists.

### High 3 - No pagination for page list and full dataset fetch

Evidence:
- `app/dashboard/sites/[id]/pages/page.tsx:379-440`
- `internal/dashboard/webhooks.ts:836-843`

Narrative:
`fetchSitePages` returns all pages, and the UI renders every row at once. Real customer sites can have hundreds or thousands of pages, so this becomes a large HTML payload, a large client tree, and a slow render. Any `router.refresh` replays the full cost.

Impact:
Scaling bottleneck, large memory usage, and slow interactions at scale.

Recommendation:
Introduce server-side pagination (limit/offset or cursor) and update the UI to paginate or virtualize the list.

### High 4 - Glossary editing recomputes and serializes the whole dataset on each change

Evidence:
- `app/dashboard/sites/glossary-table.tsx:33-47`
- `app/dashboard/sites/[id]/glossary-editor.tsx:23-40`

Narrative:
Every keystroke rebuilds the full entries array and then JSON.stringify of the entire glossary for the hidden input. On large glossaries and multiple target languages, this causes noticeable input lag. It also posts a large JSON blob on every save.

Impact:
Laggy editing experience and slow saves with large glossaries.

Recommendation:
Debounce heavy transforms, keep row-level state, and serialize only on submit. Consider diff-based updates or pagination for glossary entries.

### Medium 5 - Cache invalidation mismatch leads to stale nav and overview data

Evidence:
- `internal/dashboard/data.ts:39-75`
- `app/dashboard/actions.ts:595-719`
- `app/dashboard/actions.ts:864-887`

Narrative:
`listSitesCached` stores site data in Redis for 10 minutes. Actions that change domains or serving status revalidate paths but do not call `invalidateSitesCache`. Result: sidebar and overview can show stale domain status counts and serving states long after an action succeeds.

Impact:
UI inconsistency; users think actions did not apply.

Recommendation:
Invalidate the sites cache in domain and serving related actions, or migrate to tag-based revalidation and shorten TTLs.

### Medium 6 - Admin page fetch waterfall adds extra latency

Evidence:
- `app/dashboard/sites/[id]/admin/page.tsx:77-88`

Narrative:
The admin page fetches the site first, then starts deployments, site list, and supported language requests only after the site call completes. This adds an extra round-trip to every load.

Impact:
Slower page loads, especially on high-latency connections.

Recommendation:
Fetch site, deployments, and site list in parallel and handle the "site not found" case after all resolutions.

### Medium 7 - No-store for all webhooks API reads

Evidence:
- `internal/dashboard/webhooks.ts:450-459`
- `app/dashboard/sites/[id]/page.tsx:85-89`

Narrative:
All webhooks API requests use `cache: "no-store"` and most read endpoints are not cached at the app level (except listSites). Combined with the full refresh behavior, this produces repeated network calls for data that changes slowly (deployments, pages, glossary).

Impact:
Higher latency and API load; slower interactions.

Recommendation:
Introduce short-lived caching for read endpoints (server cache or tag-based revalidation) and minimize full refreshes.

### Low 8 - URL-based toast/error state

Evidence:
- `app/dashboard/sites/[id]/page.tsx:35-51`
- `app/dashboard/sites/[id]/pages/page.tsx:22-31`

Narrative:
Several pages parse `toast` and `error` from the URL to show banners. This forces a navigation to clear transient state and leaves error URLs shareable/bookmarkable.

Impact:
UX friction and confusing URLs.

Recommendation:
Use client-side notification state or a centralized toast store; reserve URL params for shareable state only.

### Low 9 - Hardcoded UI copy and i18n drift

Evidence:
- `app/dashboard/page.tsx:35-83`
- `app/dashboard/sites/[id]/pages/page.tsx:364-370`

Narrative:
Many dashboard strings are hard-coded despite the repo guideline to use `@internal/i18n`. This creates localization gaps and increases translation drift across pages.

Impact:
Localization debt and inconsistent copy.

Recommendation:
Move dashboard copy into `internal/i18n` and use `t(...)` consistently.

### Low 10 - No automated tests for dashboard logic

Evidence:
- `internal/dashboard/site-settings.ts:48-185`
- `app/dashboard/actions.ts:331-990`

Narrative:
Critical validation and action logic lives in plain functions without tests (site settings parsing, validation errors, action branching). There are no dashboard-specific tests under `tests/`.

Impact:
Higher regression risk; changes to form validation or action behavior are brittle.

Recommendation:
Add unit tests for site settings parsing/validation and action error handling.

## Open questions / assumptions

- Expected scale for pages per site and glossary entries. If large, pagination and virtualization become urgent.
- Whether the webhooks worker already enforces entitlements; some actions rely on server-side checks for restrictions.

## Change summary

- No code changes were made in this review.
