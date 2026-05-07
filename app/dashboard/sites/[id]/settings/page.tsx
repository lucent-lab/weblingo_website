import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { MutationLockBanner } from "@/components/dashboard/mutation-lock-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

import {
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatDate,
  SummaryRow,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

type SettingsPageProps = {
  params: Promise<{ id: string }>;
};

type SettingsProjection = Extract<SiteDashboardProjectionResponse, { meta: { view: "settings" } }>;

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;

  let projection: SettingsProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "settings");
    projection = isSettingsProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    logProjectionError(id, auth, err);
  }

  if (!projection) {
    if (error) {
      return (
        <FocusedRouteErrorState
          error={error}
          title="Unable to load settings"
          description="We could not complete your request. You can retry or return to the dashboard."
          message="Unable to load settings."
        />
      );
    }
    notFound();
  }

  const headerLabels = buildSiteHeaderLabels(t);
  const mutationsLocked = !auth.mutationsAllowed || !projection.access.mutationsAllowed;

  return (
    <div className="space-y-8">
      <SiteHeader
        site={projection.site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        {...headerLabels}
      />

      <MutationLockBanner
        locked={mutationsLocked}
        description="Settings changes are locked until this workspace can make dashboard mutations."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Focused configuration summary from the customer-safe settings projection.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCard title="Basic">
          <SummaryRow label="Source URL" value={projection.basic.sourceUrl} />
          <SummaryRow label="Profile" value={projection.basic.profile} />
          <SummaryRow label="Serving mode" value={projection.basic.servingMode} />
          <SummaryRow label="Created" value={formatDate(projection.site.createdAt)} />
          <SummaryRow label="Updated" value={formatDate(projection.site.updatedAt)} />
        </SettingsCard>

        <SettingsCard title="Routing">
          <SummaryRow label="URL mode" value={projection.routing.urlMode} />
          <SummaryRow label="Route prefixes" value={projection.routing.routePrefixes.length} />
          <SummaryRow
            label="Localized path templates"
            value={projection.routing.localizedPathTemplates?.length ?? 0}
          />
        </SettingsCard>

        <SettingsCard title="Crawl">
          <SummaryRow label="Capture mode" value={projection.crawl.captureMode} />
          <SummaryRow label="Max depth" value={projection.crawl.maxDepth} />
          <SummaryRow label="Crawl page cap" value={projection.crawl.crawlMaxPages} />
        </SettingsCard>

        <SettingsCard title="Runtime">
          <SummaryRow label="Client runtime" value={projection.runtime.clientRuntimeEnabled} />
          <SummaryRow label="SPA refresh" value={projection.runtime.spaRefreshEnabled} />
          <SummaryRow label="Footer required" value={projection.runtime.footerRequired} />
          <SummaryRow label="CSP mode" value={projection.runtime.cspMode} />
          <SummaryRow
            label="Translatable attributes"
            value={projection.runtime.translatableAttributes?.length ?? 0}
          />
        </SettingsCard>

        <SettingsCard title="Webhooks">
          <SummaryRow label="URL" value={projection.webhooks.url} />
          <SummaryRow label="Events" value={projection.webhooks.events.length} />
          <SummaryRow label="Secret configured" value={projection.webhooks.hasSecret} />
        </SettingsCard>

        <SettingsCard title="Notifications">
          <SummaryRow
            label="Digest"
            value={projection.notifications?.digestFrequency ?? "Not configured"}
          />
          <SummaryRow
            label="Locale summaries"
            value={
              Object.keys(projection.notifications?.translationSummaryFrequencyByLocale ?? {})
                .length
            }
          />
        </SettingsCard>
      </div>
    </div>
  );
}

function isSettingsProjection(
  payload: SiteDashboardProjectionResponse,
): payload is SettingsProjection {
  return payload.meta.view === "settings";
}

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl>{children}</dl>
      </CardContent>
    </Card>
  );
}

function logProjectionError(
  siteId: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch settings projection failed", {
      siteId,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn("[dashboard] fetch settings projection failed (unknown error)", {
      siteId,
      message: err,
    });
  }
}
