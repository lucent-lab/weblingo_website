import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import { listAdminAccounts, type ManagedAccountPlan } from "@internal/dashboard/webhooks";
import { setWorkspaceAction } from "../../_lib/workspace-actions";

export const metadata = {
  title: "Managed accounts",
  robots: { index: false, follow: false },
};

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">Managed accounts</h2>
          <Badge variant="outline">Internal admin</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Browse managed customer accounts, inspect their agency links, and open the detailed
          account policy editor. This surface intentionally excludes the agency plan from
          assignment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by exact account ID, plan, or managed-demo status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-end">
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="accountId"
              >
                Account ID
              </label>
              <input
                id="accountId"
                name="accountId"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={accountId}
                placeholder="acct_..."
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="planType"
              >
                Plan
              </label>
              <select
                id="planType"
                name="planType"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={resolvedSearchParams?.planType ?? "all"}
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="managedDemo"
              >
                Managed demo
              </label>
              <select
                id="managedDemo"
                name="managedDemo"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={resolvedSearchParams?.managedDemo ?? "all"}
              >
                <option value="all">All</option>
                <option value="true">Only demos</option>
                <option value="false">Exclude demos</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            {response.items.length === 0
              ? "No managed accounts matched the current filters."
              : `Showing ${response.items.length} managed account(s) starting at offset ${response.pagination.offset}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {response.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No managed accounts found.</p>
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
                      <Badge variant="outline">Plan {account.planType}</Badge>
                      <Badge variant="outline">Status {account.planStatus}</Badge>
                      {account.managedDemo ? <Badge variant="secondary">Managed demo</Badge> : null}
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                      <InfoRow label="Account ID" value={account.accountId} />
                      <InfoRow label="Sites" value={String(account.activeSiteCount)} />
                      <InfoRow label="Agency links" value={String(account.agencyLinks.length)} />
                      <InfoRow
                        label="Created"
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
                        Open account policy
                      </Link>
                    </Button>
                    <form action={setWorkspaceAction}>
                      <input name="subjectAccountId" type="hidden" value={account.accountId} />
                      <input name="redirectTo" type="hidden" value="/dashboard/sites" />
                      <Button type="submit" variant="outline" className="w-full">
                        Open workspace
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Pagination is deterministic: created-at-desc, then account-id-desc.
            </p>
            <div className="flex gap-2">
              {previousHref ? (
                <Button asChild variant="outline">
                  <Link href={previousHref}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Previous
                </Button>
              )}
              {nextHref ? (
                <Button asChild variant="outline">
                  <Link href={nextHref}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Next
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
