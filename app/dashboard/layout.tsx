import type { Metadata } from "next";
import Link from "next/link";

import { DashboardNav } from "./_components/dashboard-nav";
import { WorkspaceSwitcher } from "./_components/workspace-switcher";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/app/auth/logout/actions";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { listSites } from "@internal/dashboard/webhooks";
import { i18nConfig } from "@internal/i18n";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  robots: { index: false, follow: false },
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const auth = await requireDashboardAuth();
  const email = auth.user?.email ?? "demo@weblingo.com";
  const isAgency = auth.actorAccount?.planType === "agency";
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const navItems = [
    { href: "/dashboard", label: "Overview" },
    ...(isAgency ? [{ href: "/dashboard/agency", label: "Agency overview" }] : []),
    ...(isAgency ? [{ href: "/dashboard/agency/customers", label: "Customers" }] : []),
    { href: "/dashboard/sites", label: "Sites" },
    { href: "/dashboard/developer-tools", label: "Developer tools" },
  ];

  const workspaceOptions = buildWorkspaceOptions(auth);
  const subjectLabel =
    workspaceOptions.find((option) => option.id === auth.subjectAccountId)?.label ??
    "Current workspace";
  const maxDailyRecrawls = auth.account?.featureFlags.maxDailyRecrawls ?? null;
  const manualCrawlRemainingLabel =
    maxDailyRecrawls === null ? "Unlimited" : String(maxDailyRecrawls);

  let usageBadge: { label: string; helper?: string } | null = null;
  try {
    if (isAgency && auth.subjectAccountId === auth.actorAccountId && auth.agencyCustomers) {
      const summary = auth.agencyCustomers.summary;
      usageBadge = {
        label: `Sites: ${summary.totalActiveSites} / ${
          summary.maxSites === null ? "Unlimited" : summary.maxSites
        }`,
        helper: "Agency usage",
      };
    } else {
      const sites = await listSites(auth.webhooksAuth!);
      const activeSites = sites.filter((site) => site.status === "active").length;
      const maxSites = auth.account?.featureFlags.maxSites ?? null;
      usageBadge = {
        label: `Sites: ${activeSites} / ${maxSites === null ? "Unlimited" : maxSites}`,
      };
    }
  } catch (error) {
    console.warn("[dashboard] usage badge fetch failed:", error);
  }
  const billingBanner = resolveBillingBanner(auth);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">WebLingo Dashboard</p>
            <h1 className="text-3xl font-semibold">Manage your translated sites</h1>
            <p className="text-sm text-muted-foreground">
              Onboard new sites, monitor deployments, and fine-tune translations.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Plan: {auth.account?.planType ?? "unknown"}</Badge>
              <Badge variant="outline">Status: {auth.account?.planStatus ?? "unknown"}</Badge>
              {auth.actingAsCustomer && auth.actorAccount?.planType === "agency" ? (
                <Badge variant="outline">
                  Agency status: {auth.actorAccount.planStatus ?? "unknown"}
                </Badge>
              ) : null}
              {auth.account ? (
                <>
                  <Badge variant="outline">
                    Manual site crawls remaining: {manualCrawlRemainingLabel}
                  </Badge>
                  <Badge variant="outline">
                    Manual page crawls remaining: {manualCrawlRemainingLabel}
                  </Badge>
                </>
              ) : null}
              {usageBadge ? <Badge variant="outline">{usageBadge.label}</Badge> : null}
              {auth.actingAsCustomer ? (
                <Badge className="bg-primary/10 text-primary">Acting as {subjectLabel}</Badge>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Signed in
              </span>
              <span className="text-sm font-medium">{email}</span>
            </div>
            <form action={logout}>
              <Button size="sm" variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {billingBanner ? (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
            <p>{billingBanner.message}</p>
            <Button asChild size="sm" variant="secondary">
              <Link href={pricingPath}>{billingBanner.ctaLabel}</Link>
            </Button>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Navigation</p>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Beta
              </span>
            </div>
            <div className="mt-4">
              <DashboardNav items={navItems} />
            </div>
            {isAgency && workspaceOptions.length > 1 ? (
              <div className="mt-6">
                <WorkspaceSwitcher
                  options={workspaceOptions}
                  currentId={auth.subjectAccountId ?? auth.actorAccountId ?? ""}
                />
              </div>
            ) : null}
            <div className="mt-6 space-y-1 rounded-md bg-muted/70 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Need help?</p>
              <p>Check DNS instructions on each domain or email support@weblingo.com.</p>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function buildWorkspaceOptions(auth: Awaited<ReturnType<typeof requireDashboardAuth>>) {
  const actorId = auth.actorAccountId ?? auth.actorAccount?.accountId;
  if (!actorId) {
    return [];
  }
  const options = [
    {
      id: actorId,
      label: auth.actorAccount?.planType === "agency" ? "My agency" : "My account",
    },
  ];
  if (auth.agencyCustomers) {
    for (const customer of auth.agencyCustomers.customers) {
      if (customer.status !== "active") {
        continue;
      }
      const label = customer.customerEmail
        ? customer.customerEmail
        : `Customer ${customer.customerAccountId.slice(0, 8)}`;
      options.push({ id: customer.customerAccountId, label });
    }
  }
  return options;
}

function resolveBillingBanner(auth: DashboardAuth): { message: string; ctaLabel: string } | null {
  const issue = auth.billingIssue;
  if (!issue) {
    return null;
  }
  const status = issue.status.replace("_", " ");
  const isAgency = auth.actorAccount?.planType === "agency";
  if (issue.scope === "actor" && isAgency) {
    return {
      message: auth.actingAsCustomer
        ? `Agency billing is ${status}. Actions across managed sites are restricted until billing is updated.`
        : `Your agency plan is ${status}. Actions across managed sites are restricted until billing is updated.`,
      ctaLabel: "Update billing",
    };
  }
  if (issue.scope === "actor") {
    return {
      message: `Your plan is ${status}. Actions that change data are restricted until billing is updated.`,
      ctaLabel: "Update billing",
    };
  }
  if (auth.actingAsCustomer && isAgency) {
    return {
      message: `This customer account is ${status}. Actions in this workspace are restricted until billing is updated.`,
      ctaLabel: "Update billing",
    };
  }
  return {
    message: `Your plan is ${status}. Actions that change data are restricted until billing is updated.`,
    ctaLabel: "Update billing",
  };
}
