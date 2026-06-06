import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Briefcase, Globe, LayoutDashboard, MonitorPlay, Users, Wrench } from "lucide-react";

import { DashboardNav } from "./_components/dashboard-nav";
import { SitesNav, type SiteNavEntry } from "./_components/sites-nav";
import { WorkspaceSwitcher } from "./_components/workspace-switcher";

import { DashboardAnalyticsIdentity } from "@/components/dashboard/analytics-identity";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
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
import {
  getActiveAgencyCustomers,
  getDashboardAuth,
  hasActorInternalOps,
  shouldRecoverDashboardDemoSession,
  type DashboardAuth,
  type WebhooksAuthContext,
} from "@internal/dashboard/auth";
import { formatStripeBillingStatusLabel } from "@internal/dashboard/billing-runtime";
import { listSitesCached, listSitesFresh } from "@internal/dashboard/data";
import { DASHBOARD_DEMO_LOCALE_HEADER } from "@internal/dashboard/demo-session-constants";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import {
  getDashboardSitesLabel,
  resolveDashboardMaxSitesLimit,
  resolveDashboardWebsiteWorkspaceState,
  resolveDashboardWorkspaceAudience,
} from "@internal/dashboard/workspace";
import { getDashboardDemoSiteId } from "@internal/dashboard/demo-scope";
import { normalizeLocale, resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";
import type { SiteSummary } from "@internal/dashboard/webhooks";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  robots: { index: false, follow: false },
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

type LayoutSitesReader = (auth: WebhooksAuthContext) => Promise<SiteSummary[]>;
type LayoutDemoScopeAuth = {
  accessMode?: DashboardAuth["accessMode"];
  demoSession?: { siteId: string } | null;
};
type DashboardHeaderReader = Pick<Headers, "get">;

export function resolveLayoutSitesReader(isAgency: boolean): LayoutSitesReader {
  return isAgency ? listSitesCached : listSitesFresh;
}

export function resolveDashboardNavItems({
  isAgency,
  canAccessInternalOps,
  demoSiteId,
}: {
  isAgency: boolean;
  canAccessInternalOps: boolean;
  demoSiteId: string | null;
}) {
  if (demoSiteId) {
    return [
      {
        href: `/dashboard/sites/${demoSiteId}`,
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ];
  }

  return [
    {
      href: "/dashboard",
      label: "Dashboard",
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
    ...(canAccessInternalOps
      ? [
          {
            href: "/dashboard/ops",
            label: "Ops",
            icon: <Wrench className="h-4 w-4" />,
          },
          {
            href: "/dashboard/ops/accounts",
            label: "Accounts",
            icon: <Users className="h-4 w-4" />,
          },
          {
            href: "/dashboard/ops/showcases",
            label: "Showcases",
            icon: <MonitorPlay className="h-4 w-4" />,
          },
        ]
      : []),
  ];
}

export function resolveDashboardShellLocale(requestHeaders: DashboardHeaderReader) {
  const demoLocale = requestHeaders.get(DASHBOARD_DEMO_LOCALE_HEADER);
  return demoLocale
    ? normalizeLocale(demoLocale)
    : resolvePreferredLocale(requestHeaders.get("accept-language"));
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const requestHeaders = await headers();
  const auth = await getDashboardAuth();
  if (!auth.user || !auth.session) {
    if (await shouldRecoverDashboardDemoSession(auth)) {
      redirect(
        withDashboardLocale("/dashboard/demo", requestHeaders.get(DASHBOARD_DEMO_LOCALE_HEADER)),
      );
    }
    redirect("/auth/login");
  }
  if (!auth.webhooksAuth || !auth.account) {
    return children;
  }

  const locale = resolveDashboardShellLocale(requestHeaders);
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const email = auth.user?.email ?? "—";
  const workspaceAudience = resolveDashboardWorkspaceAudience(auth);
  const isAgency = workspaceAudience === "agency";
  const sitesLabel = getDashboardSitesLabel(workspaceAudience);
  const canAccessInternalOps = hasActorInternalOps(auth);
  const demoSiteId = getDashboardDemoSiteId(auth);
  const pricingPath = `/${locale}/pricing`;
  const navItems = resolveDashboardNavItems({ isAgency, canAccessInternalOps, demoSiteId });
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
  const statusLabel = rawStatusLabel.replaceAll("_", " ");
  const statusTone = resolveStatusTone(rawStatusLabel);

  const billingBanner = resolveBillingBanner(auth);
  const stripeBillingLabel = formatStripeBillingStatusLabel(auth.stripeBillingRuntime);
  const showTeamSwitcher = isAgency && workspaceOptions.length > 0;
  const teamSwitcherDisabled = workspaceOptions.length <= 1;
  const listLayoutSites = resolveLayoutSitesReader(isAgency);

  return (
    <SidebarProvider defaultOpen>
      <DashboardAnalyticsIdentity
        userId={auth.user.id}
        accountId={auth.subjectAccountId ?? auth.account.accountId}
        actorAccountId={auth.actorAccountId}
        planType={auth.account.planType}
        planStatus={auth.account.planStatus}
        workspaceAudience={workspaceAudience}
        actingAsCustomer={auth.actingAsCustomer}
      />
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
            <SidebarGroupLabel>{sitesLabel}</SidebarGroupLabel>
            <SidebarGroupContent>
              <Suspense fallback={<SitesNavSkeleton />}>
                <SitesNavAsync
                  auth={auth}
                  emptyLabel={isAgency ? "No sites yet." : "No website yet."}
                  listSites={listLayoutSites}
                />
              </Suspense>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-sidebar-foreground">Need help?</p>
            <p>Check DNS instructions on each domain or email contact@weblingo.app.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full bg-transparent">
              <Link href="mailto:contact@weblingo.app">Get support</Link>
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
                  <Suspense fallback={<SitesUsageFallback label={sitesLabel} />}>
                    <SitesUsageSummaryAsync
                      auth={auth}
                      isAgency={isAgency}
                      listSites={listLayoutSites}
                      sitesLabel={sitesLabel}
                    />
                  </Suspense>
                </nav>
                {auth.actingAsCustomer ? (
                  <Badge variant="outline" className="ph-mask text-[10px] uppercase tracking-wide">
                    Acting as {subjectLabel}
                  </Badge>
                ) : null}
                {auth.actingAsCustomer && isAgency ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Agency status: {auth.actorAccount?.planStatus ?? "unknown"}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Signed in
                  </span>
                  <span className="ph-mask text-sm font-medium">{email}</span>
                  {stripeBillingLabel ? (
                    <Badge
                      variant="outline"
                      className="mt-2 w-fit text-[10px] uppercase tracking-wide"
                    >
                      {stripeBillingLabel}
                    </Badge>
                  ) : null}
                </div>
                <form action={logout}>
                  <SignOutButton>{t("dashboard.auth.signOut", "Sign out")}</SignOutButton>
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

// Async component for sidebar sites navigation - streams in while layout shell renders
async function SitesNavAsync({
  auth,
  emptyLabel,
  listSites,
}: {
  auth: DashboardAuth;
  emptyLabel: string;
  listSites: LayoutSitesReader;
}) {
  let sites: SiteSummary[] = [];
  try {
    if (auth.webhooksAuth) {
      sites = filterLayoutSitesForAuth(auth, await listSites(auth.webhooksAuth));
    }
  } catch (error) {
    console.warn("[dashboard] listSites failed:", error);
  }

  const siteNav = resolveLayoutSiteNavPresentation({
    auth,
    sites,
    emptyLabel,
  });

  return <SitesNav emptyLabel={siteNav.emptyLabel} sites={siteNav.sites} />;
}

export function resolveLayoutSiteNavEntries({
  auth,
  sites,
}: {
  auth: Parameters<typeof resolveDashboardWebsiteWorkspaceState>[0] & LayoutDemoScopeAuth;
  sites: SiteSummary[];
}): SiteNavEntry[] {
  return resolveLayoutSiteNavPresentation({ auth, sites, emptyLabel: "" }).sites;
}

export function resolveLayoutSiteNavEmptyLabel({
  auth,
  sites,
  emptyLabel,
}: {
  auth: Parameters<typeof resolveDashboardWebsiteWorkspaceState>[0] & LayoutDemoScopeAuth;
  sites: SiteSummary[];
  emptyLabel: string;
}): string {
  return resolveLayoutSiteNavPresentation({ auth, sites, emptyLabel }).emptyLabel;
}

export function resolveLayoutSiteNavPresentation({
  auth,
  sites,
  emptyLabel,
}: {
  auth: Parameters<typeof resolveDashboardWebsiteWorkspaceState>[0] & LayoutDemoScopeAuth;
  sites: SiteSummary[];
  emptyLabel: string;
}): { emptyLabel: string; sites: SiteNavEntry[] } {
  const workspace = resolveDashboardWebsiteWorkspaceState(
    auth,
    filterLayoutSitesForAuth(auth, sites),
  );
  return {
    emptyLabel:
      workspace.kind === "duplicate_current_websites" ? "Website records need review." : emptyLabel,
    sites: workspace.visibleSites.map((site) => ({
      id: site.id,
      label: formatSiteLabel(site.sourceUrl),
      status: site.status,
    })),
  };
}

export function filterLayoutSitesForAuth(
  auth: LayoutDemoScopeAuth,
  sites: SiteSummary[],
): SiteSummary[] {
  const demoSiteId = getDashboardDemoSiteId(auth);
  return demoSiteId ? sites.filter((site) => site.id === demoSiteId) : sites;
}

// Skeleton fallback for sidebar sites while loading
function SitesNavSkeleton() {
  return (
    <div className="space-y-2 px-2">
      <div className="h-8 w-full animate-pulse rounded-md bg-sidebar-accent/50" />
      <div className="h-6 w-3/4 animate-pulse rounded-md bg-sidebar-accent/30" />
      <div className="h-6 w-2/3 animate-pulse rounded-md bg-sidebar-accent/30" />
    </div>
  );
}

// Async component for sites usage in header - shares cached fetch with sidebar
async function SitesUsageSummaryAsync({
  auth,
  isAgency,
  listSites,
  sitesLabel,
}: {
  auth: DashboardAuth;
  isAgency: boolean;
  listSites: LayoutSitesReader;
  sitesLabel: string;
}) {
  const isAgencyViewingSelf = isAgency && auth.subjectAccountId === auth.actorAccountId;

  if (isAgency && isAgencyViewingSelf && auth.agencyCustomers) {
    const summary = auth.agencyCustomers.summary;
    return (
      <span className="flex items-center gap-1" title="Agency usage">
        <span className="text-muted-foreground">Sites</span>
        <span className="text-foreground">
          {summary.totalActiveSites} / {summary.maxSites === null ? "Unlimited" : summary.maxSites}
        </span>
      </span>
    );
  }

  if (!auth.webhooksAuth) {
    return <SitesUsageFallback label={sitesLabel} />;
  }

  let sites: SiteSummary[];
  try {
    sites = filterLayoutSitesForAuth(auth, await listSites(auth.webhooksAuth));
  } catch (error) {
    console.warn("[dashboard] usage badge fetch failed:", error);
    return <SitesUsageFallback label={sitesLabel} />;
  }

  const activeSiteCount = sites.filter((site) => site.status === "active").length;
  const maxSites = resolveDashboardMaxSitesLimit(auth);

  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{sitesLabel}</span>
      <span className="text-foreground">
        {activeSiteCount} / {maxSites === null ? "Unlimited" : maxSites}
      </span>
    </span>
  );
}

// Fallback for sites usage while loading
function SitesUsageFallback({ label = "Sites" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">—</span>
    </span>
  );
}

function buildWorkspaceOptions(auth: DashboardAuth) {
  const actorId = auth.actorAccountId ?? auth.actorAccount?.accountId;
  if (!actorId) {
    return [];
  }
  const options = [
    {
      id: actorId,
      label: resolveDashboardWorkspaceAudience(auth) === "agency" ? "My agency" : "My account",
    },
  ];
  for (const customer of getActiveAgencyCustomers(auth.agencyCustomers)) {
    const label = customer.customerEmail
      ? customer.customerEmail
      : `Customer ${customer.customerAccountId.slice(0, 8)}`;
    options.push({ id: customer.customerAccountId, label });
  }
  return options;
}

function resolveBillingBanner(auth: DashboardAuth): { message: string; ctaLabel: string } | null {
  const issue = auth.billingIssue;
  if (!issue) {
    return null;
  }
  const status = issue.status.replaceAll("_", " ");
  const isAgency = resolveDashboardWorkspaceAudience(auth) === "agency";
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
