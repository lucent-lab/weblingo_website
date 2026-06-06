import { headers } from "next/headers";

import { DashboardSiteAnalyticsScope } from "@/components/dashboard/analytics-identity";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { DASHBOARD_DEMO_LOCALE_HEADER } from "@internal/dashboard/demo-session-constants";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import { resolveDashboardWorkspaceAudience } from "@internal/dashboard/workspace";
import { normalizeLocale, resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

import { DemoActivationReminder } from "./demo-guidance";

type SiteDashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function SiteDashboardLayout({ children, params }: SiteDashboardLayoutProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const requestHeaders = await headers();
  const demoLocale = requestHeaders.get(DASHBOARD_DEMO_LOCALE_HEADER);
  const dashboardLocale = demoLocale ? normalizeLocale(demoLocale) : null;
  const locale = dashboardLocale ?? resolvePreferredLocale(requestHeaders.get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const isScopedDemo = auth.accessMode === "demo" && auth.demoSession?.siteId === id;
  const activationHref = withDashboardLocale(
    `/dashboard/sites/${id}#activate-demo`,
    dashboardLocale,
  );
  const workspaceAudience = resolveDashboardWorkspaceAudience(auth);
  const actorRole =
    auth.actingAsCustomer && workspaceAudience === "agency" ? "agency_actor" : workspaceAudience;

  return (
    <div className="space-y-6">
      <DashboardSiteAnalyticsScope
        siteId={id}
        accountId={auth.subjectAccountId ?? auth.account?.accountId}
        actorAccountId={auth.actorAccountId}
        actorRole={actorRole}
        planType={auth.account?.planType}
        planStatus={auth.account?.planStatus}
        workspaceAudience={workspaceAudience}
        actingAsCustomer={auth.actingAsCustomer}
      />
      {isScopedDemo ? <DemoActivationReminder href={activationHref} t={t} /> : null}
      {children}
    </div>
  );
}
