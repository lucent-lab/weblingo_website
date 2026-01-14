import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Briefcase, Globe, LayoutDashboard, Users, Wrench } from "lucide-react";

import { DashboardNav } from "./_components/dashboard-nav";
import { SitesNav, type SiteNavEntry } from "./_components/sites-nav";
import { WorkspaceSwitcher } from "./_components/workspace-switcher";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { logout } from "@/app/auth/logout/actions";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached } from "@internal/dashboard/data";
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
  const email = auth.user?.email ?? "demo@webligno.app";
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
  const dailyUsage = auth.account?.dailyCrawlUsage;
  const maxDailySiteCrawls = auth.account?.featureFlags.maxDailyRecrawls ?? null;
  const maxDailyPageCrawls = auth.account?.featureFlags.maxDailyPageRecrawls ?? null;
  const siteCrawlsUsed = dailyUsage?.siteCrawls ?? 0;
  const pageCrawlsUsed = dailyUsage?.pageCrawls ?? 0;
  const siteCrawlsRemaining =
    maxDailySiteCrawls === null ? null : Math.max(maxDailySiteCrawls - siteCrawlsUsed, 0);
  const pageCrawlsRemaining =
    maxDailyPageCrawls === null ? null : Math.max(maxDailyPageCrawls - pageCrawlsUsed, 0);
  const siteCrawlDisplay =
    maxDailySiteCrawls === null ? "Unlimited" : `${siteCrawlsRemaining} left`;
  const pageCrawlDisplay =
    maxDailyPageCrawls === null ? "Unlimited" : `${pageCrawlsRemaining} left`;
  const siteCrawlTitle =
    maxDailySiteCrawls === null
      ? "Unlimited per day"
      : `${siteCrawlsUsed}/${maxDailySiteCrawls} used today`;
  const pageCrawlTitle =
    maxDailyPageCrawls === null
      ? "Unlimited per day"
      : `${pageCrawlsUsed}/${maxDailyPageCrawls} used today`;
  const planLabel = auth.account?.planType ?? "unknown";
  const rawStatusLabel = auth.account?.planStatus ?? "unknown";
  const statusLabel = rawStatusLabel.replace("_", " ");
  const statusTone = resolveStatusTone(rawStatusLabel);
  let siteNavItems: SiteNavEntry[] = [];
  try {
    if (auth.webhooksAuth) {
      const sites = await listSitesCached(auth.webhooksAuth);
      siteNavItems = sites.map((site) => ({
        id: site.id,
        label: formatSiteLabel(site.sourceUrl),
        status: site.status,
      }));
    }
  } catch (error) {
    console.warn("[dashboard] listSites failed:", error);
  }

  const billingBanner = resolveBillingBanner(auth);
  const showTeamSwitcher = isAgency && workspaceOptions.length > 0;
  const teamSwitcherDisabled = workspaceOptions.length <= 1;

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-4">
          <div className="flex items-center gap-2 px-2 pt-2 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:pt-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Globe className="h-4 w-4" />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold">WebLingo</span>
              <span className="text-xs text-sidebar-foreground/70">Dashboard</span>
            </div>
            <SidebarTrigger className="ml-auto md:hidden" />
          </div>
          {showTeamSwitcher ? (
            <div className="px-2 group-data-[collapsible=icon]:hidden">
              <WorkspaceSwitcher
                label="Teams"
                options={workspaceOptions}
                currentId={auth.subjectAccountId ?? auth.actorAccountId ?? ""}
                disabled={teamSwitcherDisabled}
              />
            </div>
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <Badge
                variant="secondary"
                className="text-[10px] uppercase tracking-wide group-data-[collapsible=icon]:hidden"
              >
                Beta
              </Badge>
            </div>
            <SidebarGroupContent>
              <DashboardNav items={navItems} />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Sites</SidebarGroupLabel>
            <SidebarGroupContent>
              <SitesNav sites={siteNavItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-sidebar-foreground">Need help?</p>
            <p>Check DNS instructions on each domain or email contact@webligno.app.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full bg-transparent">
              <Link href="mailto:contact@webligno.app">Get support</Link>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-muted/30">
        <header className="border-b bg-background">
          <div className="flex w-full flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                <SidebarTrigger className="shrink-0" />
                <div className="hidden h-5 w-px bg-border sm:block" />
                <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="text-foreground">{planLabel}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Status</span>
                    <span className={statusTone}>{statusLabel}</span>
                  </span>
                  {auth.account ? (
                    <>
                      <span className="flex items-center gap-1" title={siteCrawlTitle}>
                        <span className="text-muted-foreground">Site crawls</span>
                        <span className="text-foreground">{siteCrawlDisplay}</span>
                      </span>
                      <span className="flex items-center gap-1" title={pageCrawlTitle}>
                        <span className="text-muted-foreground">Page crawls</span>
                        <span className="text-foreground">{pageCrawlDisplay}</span>
                      </span>
                    </>
                  ) : null}
                  <Suspense fallback={<SitesUsageFallback />}>
                    <SitesUsageSummary auth={auth} isAgency={isAgency} />
                  </Suspense>
                </nav>
                {auth.actingAsCustomer ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Acting as {subjectLabel}
                  </Badge>
                ) : null}
                {auth.actingAsCustomer && auth.actorAccount?.planType === "agency" ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Agency status: {auth.actorAccount.planStatus ?? "unknown"}
                  </Badge>
                ) : null}
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
          </div>
        </header>

        <section className="flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
          {billingBanner ? (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
              <p>{billingBanner.message}</p>
              <Button asChild size="sm" variant="secondary">
                <Link href={pricingPath}>{billingBanner.ctaLabel}</Link>
              </Button>
            </div>
          ) : null}

          {children}
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function SitesUsageSummary({ auth, isAgency }: { auth: DashboardAuth; isAgency: boolean }) {
  let sitesUsage: { value: string; helper?: string } | null = null;
  try {
    if (isAgency && auth.subjectAccountId === auth.actorAccountId && auth.agencyCustomers) {
      const summary = auth.agencyCustomers.summary;
      sitesUsage = {
        value: `${summary.totalActiveSites} / ${summary.maxSites === null ? "Unlimited" : summary.maxSites}`,
        helper: "Agency usage",
      };
    } else {
      const sites = await listSitesCached(auth.webhooksAuth!);
      const activeSites = sites.filter((site) => site.status === "active").length;
      const maxSites = auth.account?.featureFlags.maxSites ?? null;
      sitesUsage = {
        value: `${activeSites} / ${maxSites === null ? "Unlimited" : maxSites}`,
      };
    }
  } catch (error) {
    console.warn("[dashboard] usage badge fetch failed:", error);
  }

  return (
    <span className="flex items-center gap-1" title={sitesUsage?.helper}>
      <span className="text-muted-foreground">Sites</span>
      <span className="text-foreground">{sitesUsage?.value ?? "—"}</span>
    </span>
  );
}

function SitesUsageFallback() {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">Sites</span>
      <span className="text-foreground">—</span>
    </span>
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

function resolveStatusTone(status: string): string {
  if (status === "active") {
    return "text-emerald-600";
  }
  if (status === "past_due" || status === "cancelled") {
    return "text-destructive";
  }
  return "text-muted-foreground";
}

function formatSiteLabel(sourceUrl: string): string {
  try {
    const hostname = new URL(sourceUrl).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
