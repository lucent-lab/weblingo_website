import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { setWorkspaceAction } from "../../_lib/workspace-actions";
import { CustomerInviteForm } from "../customer-invite-form";

type CustomersPageProps = {
  searchParams?: Promise<{
    status?: string;
    plan?: string;
    query?: string;
  }>;
};

export default async function AgencyCustomersPage({ searchParams }: CustomersPageProps) {
  const auth = await requireDashboardAuth();
  if (auth.actorAccount?.planType !== "agency") {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const customers = auth.agencyCustomers?.customers ?? [];
  const statusFilter = resolvedSearchParams?.status ?? "all";
  const planFilter = resolvedSearchParams?.plan ?? "all";
  const query = resolvedSearchParams?.query?.trim().toLowerCase() ?? "";

  const filtered = customers.filter((customer) => {
    if (statusFilter !== "all" && customer.status !== statusFilter) {
      return false;
    }
    if (planFilter !== "all" && customer.customerPlan !== planFilter) {
      return false;
    }
    if (query) {
      const haystack =
        `${customer.customerEmail ?? ""} ${customer.customerAccountId}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Customers</h2>
        <p className="text-sm text-muted-foreground">
          Manage customer accounts, plans, and jump into their workspaces.
        </p>
      </div>

      <CustomerInviteForm />

      <Card>
        <CardHeader>
          <CardTitle>Customer list</CardTitle>
          <CardDescription>Filter by plan or status and open a workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="query"
              >
                Search
              </label>
              <Input
                id="query"
                name="query"
                placeholder="Email or account id"
                defaultValue={query}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="plan"
              >
                Plan
              </label>
              <select
                id="plan"
                name="plan"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={planFilter}
              >
                <option value="all">All</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase text-muted-foreground"
                htmlFor="status"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                defaultValue={statusFilter}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply filters
            </Button>
          </form>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers match this filter.</p>
          ) : (
            filtered.map((customer) => (
              <div
                key={customer.customerAccountId}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    {customer.customerEmail ?? customer.customerAccountId}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Plan: {customer.customerPlan}</Badge>
                    <Badge variant="outline">Status: {customer.planStatus}</Badge>
                    <Badge variant="outline">Link: {customer.status}</Badge>
                    <Badge variant="outline">Sites: {customer.activeSiteCount}</Badge>
                  </div>
                </div>
                <form action={setWorkspaceAction}>
                  <input name="subjectAccountId" type="hidden" value={customer.customerAccountId} />
                  <input name="redirectTo" type="hidden" value="/dashboard/sites" />
                  <Button type="submit" variant="secondary">
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
