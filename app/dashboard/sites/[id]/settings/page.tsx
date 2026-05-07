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
import { listSupportedLanguagesCached } from "@internal/dashboard/data";
import { deriveSiteSettingsAccess } from "@internal/dashboard/site-settings";
import { resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

import {
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatDate,
  SummaryRow,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";
import { PageSectionNav } from "../page-section-nav";
import { SiteSettingsForm } from "./site-settings-form";

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
  const settingsAccess = deriveSiteSettingsAccess({
    has: auth.has,
    mutationsAllowed: auth.mutationsAllowed,
  });
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canResumeTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;

  let projection: SettingsProjection | null = null;
  let supportedLanguages: Awaited<ReturnType<typeof listSupportedLanguagesCached>> = [];
  let error: unknown = null;

  try {
    const [payload, supportedLanguagePayload] = await Promise.all([
      fetchSiteDashboardProjection(authToken, id, "settings"),
      settingsAccess.canEditLocales ? listSupportedLanguagesCached() : Promise.resolve([]),
    ]);
    projection = isSettingsProjection(payload) ? payload : null;
    supportedLanguages = supportedLanguagePayload;
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
          description="We could not load the editable site settings for this workspace."
          message="Unable to load site settings."
          siteId={id}
          retryHref={`/dashboard/sites/${id}/settings`}
          retryLabel="Retry settings"
          nextSteps={[
            "Retry settings.",
            "Open the site overview to check current health and next actions.",
            "Contact support with the reference code if settings remain unavailable.",
          ]}
        />
      );
    }
    notFound();
  }

  const headerLabels = buildSiteHeaderLabels(t);
  const mutationsLocked = !auth.mutationsAllowed || !projection.access.mutationsAllowed;
  const billingBlocked = settingsAccess.billingBlocked;
  const lockedHelp = t("dashboard.site.settings.lockedHelp");
  const crawlCaptureCopy = {
    title: t("dashboard.site.settings.crawlCapture.title"),
    description: t("dashboard.site.settings.crawlCapture.description"),
    label: t("dashboard.site.settings.crawlCapture.label"),
    help: t("dashboard.site.settings.crawlCapture.help"),
    options: {
      templatePlusHydrated: t("dashboard.site.settings.crawlCapture.option.template_plus_hydrated"),
      templateOnly: t("dashboard.site.settings.crawlCapture.option.template_only"),
      hydratedOnly: t("dashboard.site.settings.crawlCapture.option.hydrated_only"),
    },
  };
  const clientRuntimeCopy = {
    title: t("dashboard.site.settings.clientRuntime.title"),
    description: t("dashboard.site.settings.clientRuntime.description"),
    label: t("dashboard.site.settings.clientRuntime.label"),
    help: t("dashboard.site.settings.clientRuntime.help"),
  };
  const spaRefreshCopy = {
    title: t("dashboard.site.settings.spaRefresh.title"),
    description: t("dashboard.site.settings.spaRefresh.description"),
    label: t("dashboard.site.settings.spaRefresh.label"),
    help: t("dashboard.site.settings.spaRefresh.help"),
    note: t("dashboard.site.settings.spaRefresh.note"),
    missingFallbackLabel: t("dashboard.site.settings.spaRefresh.missingFallback.label"),
    missingFallbackHelp: t("dashboard.site.settings.spaRefresh.missingFallback.help"),
    errorFallbackLabel: t("dashboard.site.settings.spaRefresh.errorFallback.label"),
    errorFallbackHelp: t("dashboard.site.settings.spaRefresh.errorFallback.help"),
    sectionScopeLabel: t("dashboard.site.settings.spaRefresh.sectionScope.label"),
    sectionScopeHelp: t("dashboard.site.settings.spaRefresh.sectionScope.help"),
    optionGlobalOnly: t("dashboard.site.settings.spaRefresh.option.globalOnly"),
    optionBaseline: t("dashboard.site.settings.spaRefresh.option.baseline"),
  };
  const translatableAttributesCopy = {
    title: t("dashboard.site.settings.translatableAttributes.title"),
    description: t("dashboard.site.settings.translatableAttributes.description"),
    label: t("dashboard.site.settings.translatableAttributes.label"),
    help: t("dashboard.site.settings.translatableAttributes.help"),
    placeholder: t("dashboard.site.settings.translatableAttributes.placeholder"),
  };

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

      {billingBlocked || mutationsLocked ? (
        <Card className="border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle>{billingBlocked ? "Billing action required" : "Settings locked"}</CardTitle>
            <CardDescription>
              {billingBlocked
                ? "Update billing to resume editing this site."
                : "This workspace cannot make settings changes right now."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <PageSectionNav
        title="Settings sections"
        description="Focused configuration controls for source, routing, runtime, webhooks, and translation context."
        links={[
          { href: "#site-settings", label: "Site settings" },
          { href: "#settings-summary", label: "Summary" },
        ]}
      />

      <section id="site-settings" className="scroll-mt-24">
        <SiteSettingsForm
          siteId={projection.site.id}
          sourceUrl={projection.basic.sourceUrl}
          sourceLang={projection.settings.sourceLang}
          targets={projection.settings.targetLangs}
          aliases={projection.settings.aliases}
          pattern={projection.settings.pattern ?? null}
          maxLocales={projection.settings.maxLocales}
          servingMode={projection.settings.servingMode}
          crawlCaptureMode={projection.settings.crawlCaptureMode}
          crawlCaptureCopy={crawlCaptureCopy}
          clientRuntimeEnabled={projection.settings.clientRuntimeEnabled}
          clientRuntimeCopy={clientRuntimeCopy}
          spaRefresh={projection.settings.spaRefresh ?? null}
          spaRefreshCopy={spaRefreshCopy}
          translatableAttributes={projection.settings.translatableAttributes ?? null}
          translatableAttributesCopy={translatableAttributesCopy}
          webhookUrl={projection.settings.webhookUrl ?? ""}
          webhookSecret=""
          webhookEvents={projection.settings.webhookEvents}
          canEditWebhooks={settingsAccess.canEditWebhooks}
          lockedHelp={lockedHelp}
          canEditBasics={settingsAccess.canEditBasics}
          canEditLocales={settingsAccess.canEditLocales}
          canEditServingMode={settingsAccess.canEditServingMode}
          canEditCrawlCaptureMode={settingsAccess.canEditCrawlCaptureMode}
          canEditClientRuntime={settingsAccess.canEditClientRuntime}
          canEditSpaRefresh={settingsAccess.canEditSpaRefresh}
          canEditTranslatableAttributes={settingsAccess.canEditTranslatableAttributes}
          canEditProfile={settingsAccess.canEditProfile}
          supportedLanguages={supportedLanguages}
          displayLocale={locale}
          initialBrandVoice={projection.settings.siteProfile?.brandVoice}
          initialSiteProfileNotes={projection.settings.siteProfile?.description}
        />
      </section>

      <section id="settings-summary" className="scroll-mt-24 space-y-4">
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
      </section>
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
