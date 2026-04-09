import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountPolicyForm } from "../account-policy-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import {
  getAdminAccount,
  WebhooksApiError,
  type ManagedAccountPolicy,
} from "@internal/dashboard/webhooks";
import { setWorkspaceAction } from "../../../_lib/workspace-actions";

export const metadata = {
  title: "Managed account policy",
  robots: { index: false, follow: false },
};

type AccountDetailPageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function OpsAccountDetailPage({ params }: AccountDetailPageProps) {
  const { accountId } = await params;
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    notFound();
  }
  const actorAuth = auth.actorWebhooksAuth;
  if (!actorAuth) {
    notFound();
  }

  let account: ManagedAccountPolicy;
  try {
    const response = await getAdminAccount(actorAuth, accountId);
    account = response.account;
  } catch (error) {
    if (error instanceof WebhooksApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">Managed account policy</h2>
          <Badge variant="outline">Internal admin</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Account-level policy lives here. Site-level routing, locale coverage, and runtime behavior
          stay on each site’s admin page.
        </p>
      </div>

      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle>{account.accountEmail ?? account.accountId}</CardTitle>
          <CardDescription>{account.accountId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Plan {account.planType}</Badge>
            <Badge variant="outline">Status {account.planStatus}</Badge>
            {account.managedDemo ? <Badge variant="secondary">Managed demo</Badge> : null}
            <Badge variant="outline">Active sites {account.activeSiteCount}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={setWorkspaceAction}>
              <input name="subjectAccountId" type="hidden" value={account.accountId} />
              <input name="redirectTo" type="hidden" value="/dashboard/sites" />
              <Button type="submit" variant="secondary">
                Open workspace
              </Button>
            </form>
            <Button asChild variant="outline">
              <Link href="/dashboard/ops/accounts">Back to inventory</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked agencies</CardTitle>
          <CardDescription>
            Linked `agency_customers` rows stay synchronized with the managed account plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {account.agencyLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agency links found.</p>
          ) : (
            account.agencyLinks.map((link) => (
              <div
                key={`${link.agencyAccountId}:${link.createdAt ?? "link"}`}
                className="rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{link.agencyAccountId}</p>
                  <Badge variant="outline">Customer plan {link.customerPlan}</Badge>
                  <Badge variant="outline">Status {link.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Linked {link.createdAt ? new Date(link.createdAt).toLocaleString() : "—"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AccountPolicyForm account={account} />
    </div>
  );
}
