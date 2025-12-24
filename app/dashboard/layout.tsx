import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Globe, LayoutDashboard, Users, Wrench } from "lucide-react";

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
    {
      href: "/dashboard",
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    ...(isAgency
      ? [
          {
            href: "/dashboard/agency",
            label: "Agency overview",
            icon: <Briefcase className="h-4 w-4" />,
          },
        ]
      : []),
    ...(isAgency
      ? [
          {
            href: "/dashboard/agency/customers",
            label: "Customers",
            icon: <Users className="h-4 w-4" />,
          },
        ]
      : []),
    { href: "/dashboard/sites", label: "Sites", icon: <Globe className="h-4 w-4" /> },
    {
      href: "/dashboard/developer-tools",
      label: "Developer tools",
      icon: <Wrench className="h-4 w-4" />,
    },
  ];

  const workspaceOptions = buildWorkspaceOptions(auth);
  const subjectLabel =
    workspaceOptions.find((option) => option.id === auth.subjectAccountId)?.label ??
    "Current workspace";
  const maxDailyRecrawls = auth.account?.featureFlags.maxDailyRecrawls ?? null;
  const manualCrawlRemainingLabel =
    maxDailyRecrawls === null ? "Unlimited" : String(maxDailyRecrawls);
  const planLabel = auth.account?.planType ?? "unknown";
  const rawStatusLabel = auth.account?.planStatus ?? "unknown";
  const statusLabel = rawStatusLabel.replace("_", " ");

  let sitesUsage: { value: string; helper?: string } | null = null;
  try {
    if (isAgency && auth.subjectAccountId === auth.actorAccountId && auth.agencyCustomers) {
      const summary = auth.agencyCustomers.summary;
      sitesUsage = {
        value: `${summary.totalActiveSites} / ${summary.maxSites === null ? "Unlimited" : summary.maxSites}`,
        helper: "Agency usage",
      };
    } else {
      const sites = await listSites(auth.webhooksAuth!);
      const activeSites = sites.filter((site) => site.status === "active").length;
      const maxSites = auth.account?.featureFlags.maxSites ?? null;
      sitesUsage = {
        value: `${activeSites} / ${maxSites === null ? "Unlimited" : maxSites}`,
      };
    }
  } catch (error) {
    console.warn("[dashboard] usage badge fetch failed:", error);
  }
  const billingBanner = resolveBillingBanner(auth);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
                <span>WebLingo Dashboard</span>
                {auth.actingAsCustomer ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Acting as {subjectLabel}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-balance text-3xl font-semibold">Manage your translated sites</h1>
              <p className="text-sm text-muted-foreground">
                Onboard new sites, monitor deployments, and fine-tune translations.
              </p>
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
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Plan: {planLabel}</Badge>
            <Badge variant={resolveStatusVariant(rawStatusLabel)}>Status: {statusLabel}</Badge>
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
            <Badge variant="outline" title={sitesUsage?.helper}>
              Sites: {sitesUsage?.value ?? "—"}
            </Badge>
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
            <div className="mt-6 space-y-2 rounded-md bg-muted/70 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Need help?</p>
              <p>Check DNS instructions on each domain or email support@weblingo.com.</p>
              <Button asChild variant="outline" size="sm" className="w-full bg-transparent">
                <Link href="mailto:support@weblingo.com">Get support</Link>
              </Button>
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

type StatusBadgeVariant = "default" | "secondary" | "destructive" | "outline";

function resolveStatusVariant(status: string): StatusBadgeVariant {
  if (status === "active") {
    return "default";
  }
  if (status === "past_due" || status === "cancelled") {
    return "destructive";
  }
  return "outline";
}
