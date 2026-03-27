import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import { listAdminAccounts, type ManagedAccountPlan } from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";
import { setWorkspaceAction } from "../../_lib/workspace-actions";

export async function generateMetadata() {
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  return {
    title: t("dashboard.ops.accounts.meta.title", "Managed accounts"),
    robots: { index: false, follow: false },
  };
}

type AccountsPageProps = {
  searchParams?: Promise<{
    accountId?: string;
    planType?: string;
    managedDemo?: string;
    offset?: string;
  }>;
};

const PAGE_LIMIT = 20;

function normalizePlanType(value: string | undefined): ManagedAccountPlan | undefined {
  if (value === "free" || value === "starter" || value === "pro") {
    return value;
  }
  return undefined;
}

function normalizeManagedDemoFilter(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function normalizeOffset(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    return 0;
  }
  return Number.parseInt(value, 10);
}

function buildAccountsHref(
  base: { accountId?: string; planType?: string; managedDemo?: string },
  offset: number,
): string {
  const qs = new URLSearchParams();
  if (base.accountId) {
    qs.set("accountId", base.accountId);
  }
  if (base.planType && base.planType !== "all") {
    qs.set("planType", base.planType);
  }
  if (base.managedDemo && base.managedDemo !== "all") {
    qs.set("managedDemo", base.managedDemo);
  }
  if (offset > 0) {
    qs.set("offset", String(offset));
  }
  const query = qs.toString();
  return query ? `/dashboard/ops/accounts?${query}` : "/dashboard/ops/accounts";
}

export default async function OpsAccountsPage({ searchParams }: AccountsPageProps) {
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    notFound();
  }
  const actorAuth = auth.actorWebhooksAuth ?? auth.webhooksAuth;
  if (!actorAuth) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const accountId = resolvedSearchParams?.accountId?.trim() ?? "";
  const planType = normalizePlanType(resolvedSearchParams?.planType);
  const managedDemo = normalizeManagedDemoFilter(resolvedSearchParams?.managedDemo);
  const offset = normalizeOffset(resolvedSearchParams?.offset);

  const response = await listAdminAccounts(actorAuth, {
    ...(accountId ? { accountId } : {}),
    ...(planType ? { planType } : {}),
    ...(typeof managedDemo === "boolean" ? { managedDemo } : {}),
    limit: PAGE_LIMIT,
    offset,
  });

  const previousHref =
    offset > 0
      ? buildAccountsHref(
          {
            accountId,
            planType: resolvedSearchParams?.planType,
            managedDemo: resolvedSearchParams?.managedDemo,
          },
          Math.max(offset - PAGE_LIMIT, 0),
        )
      : null;
  const nextHref = response.pagination.hasMore
    ? buildAccountsHref(
        {
          accountId,
          planType: resolvedSearchParams?.planType,
          managedDemo: resolvedSearchParams?.managedDemo,
        },
        offset + PAGE_LIMIT,
      )
    : null;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const heading = t("dashboard.ops.accounts.heading", "Managed accounts");
  const badgeLabel = t("dashboard.ops.badge.internalAdmin", "Internal admin");
  const intro = t(
    "dashboard.ops.accounts.intro",
    "Browse managed customer accounts, inspect their agency links, and open the detailed account policy editor. This surface intentionally excludes the agency plan from assignment.",
  );
  const filtersTitle = t("dashboard.ops.accounts.filters.title", "Filters");
  const filtersDescription = t(
    "dashboard.ops.accounts.filters.description",
    "Search by exact account ID, plan, or managed-demo status.",
  );
  const accountIdLabel = t("dashboard.ops.accounts.filters.accountId", "Account ID");
  const accountIdPlaceholder = t("dashboard.ops.accounts.filters.accountIdPlaceholder", "acct_...");
  const planLabel = t("dashboard.ops.accounts.filters.plan", "Plan");
  const allPlansLabel = t("dashboard.ops.accounts.filters.allPlans", "All");
  const freePlanLabel = t("dashboard.ops.accounts.filters.freePlan", "Free");
  const starterPlanLabel = t("dashboard.ops.accounts.filters.starterPlan", "Starter");
  const proPlanLabel = t("dashboard.ops.accounts.filters.proPlan", "Pro");
  const managedDemoLabel = t("dashboard.ops.accounts.filters.managedDemo", "Managed demo");
  const allManagedDemoLabel = t("dashboard.ops.accounts.filters.allManagedDemo", "All");
  const onlyDemosLabel = t("dashboard.ops.accounts.filters.onlyDemos", "Only demos");
  const excludeDemosLabel = t("dashboard.ops.accounts.filters.excludeDemos", "Exclude demos");
  const applyLabel = t("dashboard.ops.accounts.filters.apply", "Apply");
  const inventoryTitle = t("dashboard.ops.accounts.inventory.title", "Inventory");
  const emptyInventoryDescription = t(
    "dashboard.ops.accounts.inventory.emptyDescription",
    "No managed accounts matched the current filters.",
  );
  const inventoryDescription = t(
    "dashboard.ops.accounts.inventory.description",
    "Showing {count} managed account(s) starting at offset {offset}.",
    {
      count: String(response.items.length),
      offset: String(response.pagination.offset),
    },
  );
  const emptyInventoryLabel = t(
    "dashboard.ops.accounts.inventory.emptyLabel",
    "No managed accounts found.",
  );
  const managedDemoBadgeLabel = t("dashboard.ops.accounts.badges.managedDemo", "Managed demo");
  const sitesLabel = t("dashboard.ops.accounts.fields.sites", "Sites");
  const agencyLinksLabel = t("dashboard.ops.accounts.fields.agencyLinks", "Agency links");
  const createdLabel = t("dashboard.ops.accounts.fields.created", "Created");
  const accountPolicyLabel = t(
    "dashboard.ops.accounts.actions.accountPolicy",
    "Open account policy",
  );
  const openWorkspaceLabel = t("dashboard.ops.accounts.actions.openWorkspace", "Open workspace");
  const paginationNote = t(
    "dashboard.ops.accounts.pagination.note",
    "Pagination is deterministic: created-at-desc, then account-id-desc.",
  );
  const previousLabel = t("dashboard.ops.accounts.pagination.previous", "Previous");
  const nextLabel = t("dashboard.ops.accounts.pagination.next", "Next");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">{heading}</h2>
          <Badge variant="outline">{badgeLabel}</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filtersTitle}</CardTitle>
          <CardDescription>{filtersDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-end">
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="accountId"
              >
                {accountIdLabel}
              </label>
              <input
                id="accountId"
                name="accountId"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={accountId}
                placeholder={accountIdPlaceholder}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="planType"
              >
                {planLabel}
              </label>
              <select
                id="planType"
                name="planType"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={resolvedSearchParams?.planType ?? "all"}
              >
                <option value="all">{allPlansLabel}</option>
                <option value="free">{freePlanLabel}</option>
                <option value="starter">{starterPlanLabel}</option>
                <option value="pro">{proPlanLabel}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="managedDemo"
              >
                {managedDemoLabel}
              </label>
              <select
                id="managedDemo"
                name="managedDemo"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={resolvedSearchParams?.managedDemo ?? "all"}
              >
                <option value="all">{allManagedDemoLabel}</option>
                <option value="true">{onlyDemosLabel}</option>
                <option value="false">{excludeDemosLabel}</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              {applyLabel}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{inventoryTitle}</CardTitle>
          <CardDescription>
            {response.items.length === 0 ? emptyInventoryDescription : inventoryDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {response.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyInventoryLabel}</p>
          ) : (
            response.items.map((account) => (
              <div
                key={account.accountId}
                className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {account.accountEmail ?? account.accountId}
                      </p>
                      <Badge variant="outline">
                        {t("dashboard.ops.accounts.badges.plan", "Plan {planType}", {
                          planType: account.planType,
                        })}
                      </Badge>
                      <Badge variant="outline">
                        {t("dashboard.ops.accounts.badges.status", "Status {planStatus}", {
                          planStatus: account.planStatus,
                        })}
                      </Badge>
                      {account.managedDemo ? (
                        <Badge variant="secondary">{managedDemoBadgeLabel}</Badge>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                      <InfoRow label={accountIdLabel} value={account.accountId} />
                      <InfoRow label={sitesLabel} value={String(account.activeSiteCount)} />
                      <InfoRow
                        label={agencyLinksLabel}
                        value={String(account.agencyLinks.length)}
                      />
                      <InfoRow
                        label={createdLabel}
                        value={
                          account.createdAt ? new Date(account.createdAt).toLocaleString() : "—"
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-64">
                    <Button asChild variant="secondary">
                      <Link
                        href={`/dashboard/ops/accounts/${encodeURIComponent(account.accountId)}`}
                      >
                        {accountPolicyLabel}
                      </Link>
                    </Button>
                    <form action={setWorkspaceAction}>
                      <input name="subjectAccountId" type="hidden" value={account.accountId} />
                      <input name="redirectTo" type="hidden" value="/dashboard/sites" />
                      <Button type="submit" variant="outline" className="w-full">
                        {openWorkspaceLabel}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">{paginationNote}</p>
            <div className="flex gap-2">
              {previousHref ? (
                <Button asChild variant="outline">
                  <Link href={previousHref}>{previousLabel}</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {previousLabel}
                </Button>
              )}
              {nextHref ? (
                <Button asChild variant="outline">
                  <Link href={nextHref}>{nextLabel}</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{label}:</span> {value}
    </div>
  );
}
