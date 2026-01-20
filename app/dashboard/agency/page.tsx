import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { setWorkspaceAction } from "../_lib/workspace-actions";

export default async function AgencyOverviewPage() {
  const auth = await requireDashboardAuth();
  if (auth.actorAccount?.planType !== "agency") {
    redirect("/dashboard");
  }

  const summary = auth.agencyCustomers?.summary;
  const customers = auth.agencyCustomers?.customers ?? [];
  const activeCustomers = customers.filter((customer) => customer.status === "active");
  const topCustomers = [...activeCustomers]
    .sort((a, b) => b.activeSiteCount - a.activeSiteCount)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Agency overview</h2>
        <p className="text-sm text-muted-foreground">
          Track customer usage and jump into any managed workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Active sites (total)"
          value={summary ? String(summary.totalActiveSites) : "—"}
          helper={`Limit: ${summary?.maxSites ?? "Unlimited"}`}
        />
        <SummaryCard
          title="Active customers"
          value={String(activeCustomers.length)}
          helper="Currently managed"
        />
        <SummaryCard
          title="Managed accounts"
          value={String(customers.length)}
          helper="Includes suspended"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top customers by site count</CardTitle>
          <CardDescription>Jump into a customer workspace to manage their sites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active customers yet. Invite a customer to get started.
            </p>
          ) : (
            topCustomers.map((customer) => (
              <div
                key={customer.customerAccountId}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {customer.customerEmail ?? customer.customerAccountId}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Plan: {customer.customerPlan}</Badge>
                    <Badge variant="outline">Status: {customer.planStatus}</Badge>
                    <Badge variant="outline">Active sites: {customer.activeSiteCount}</Badge>
                  </div>
                </div>
                <form action={setWorkspaceAction}>
                  <input name="subjectAccountId" type="hidden" value={customer.customerAccountId} />
                  <input name="redirectTo" type="hidden" value="/dashboard/sites" />
                  <Button type="submit" variant="outline">
                    View sites
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard(props: { title: string; value: string; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{props.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{props.helper}</p>
      </CardContent>
    </Card>
  );
}
