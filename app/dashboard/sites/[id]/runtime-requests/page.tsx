import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { Button } from "@/components/ui/button";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import {
  listRuntimeRequestObservationsAction,
  updateRuntimeRequestObservationLifecycleAction,
  updateRuntimeRequestPolicyAction,
} from "../../../actions";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";
import { RuntimeRequestsManager, type RuntimeRequestsCopy } from "./runtime-requests-manager";

export const metadata = {
  title: "Runtime requests",
  robots: { index: false, follow: false },
};

type RuntimeRequestsPageProps = {
  params: Promise<{ id: string }>;
};

type SiteDeveloperToolsProjection = Extract<
  SiteDashboardProjectionResponse,
  { meta: { view: "developer_tools" } }
>;

export default async function RuntimeRequestsPage({ params }: RuntimeRequestsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;

  let projection: SiteDeveloperToolsProjection | null = null;
  let error: unknown = null;

  try {
    const projectionPayload = await fetchSiteDashboardProjection(authToken, id, "developer_tools");
    projection = isDeveloperToolsProjection(projectionPayload) ? projectionPayload : null;
  } catch (err) {
    error = err;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] runtime requests failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] runtime requests failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (!projection) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load runtime requests",
        description: "We could not load runtime request observations for this site.",
        message: "Unable to load runtime requests.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          nextSteps={errorView.nextSteps}
          referenceCode={errorView.referenceCode}
          actions={
            <>
              <DashboardRetryButton
                href={`/dashboard/sites/${id}/runtime-requests`}
                label="Retry requests"
              />
              <Button asChild variant="outline">
                <Link href={`/dashboard/sites/${id}/developer-tools`}>Developer tools</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/sites/${id}`}>Site overview</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="mailto:contact@weblingo.app?subject=Dashboard%20runtime%20requests%20unavailable">
                  Contact support
                </a>
              </Button>
            </>
          }
        />
      );
    }
    notFound();
  }

  const canViewRuntimeRequests =
    projection.runtimeRequests.available && projection.access.canViewRuntimeRequests;
  const canEditRuntimeRequests = canViewRuntimeRequests && canEdit;

  return (
    <div className="space-y-8">
      <SiteHeader
        site={projection.site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        deactivateLabel={t("dashboard.site.status.deactivate")}
        reactivateLabel={t("dashboard.site.status.reactivate")}
        deactivateConfirm={t("dashboard.site.status.deactivateConfirm")}
        activateHelpLabel={t("dashboard.site.status.activateHelpLabel")}
        activateHelp={t("dashboard.site.status.activateHelp")}
      />

      {canViewRuntimeRequests ? (
        <RuntimeRequestsManager
          siteId={projection.site.id}
          initialPolicy={projection.runtimeRequests.policy}
          runtimeRequestPolicyFingerprint={
            projection.runtimeRequests.policySummary?.fingerprint ?? null
          }
          runtimeRequestPolicyVersion={projection.runtimeRequests.policySummary?.version ?? null}
          propagation={projection.runtimeRequests.propagation ?? null}
          observations={[]}
          observationsLoaded={false}
          canEdit={canEditRuntimeRequests}
          canLoadObservations={canViewRuntimeRequests}
          loadObservationsAction={listRuntimeRequestObservationsAction}
          saveAction={updateRuntimeRequestPolicyAction}
          lifecycleAction={updateRuntimeRequestObservationLifecycleAction}
          copy={buildRuntimeRequestsCopy(t)}
        />
      ) : (
        <LockedFeatureCard
          title={t("dashboard.runtimeRequests.locked.title", "Runtime requests")}
          description={
            mutationsAllowed
              ? t(
                  "dashboard.runtimeRequests.locked.upgrade",
                  "Upgrade to review observed interactive requests and configure runtime rules.",
                )
              : t(
                  "dashboard.runtimeRequests.locked.billing",
                  "Update billing to resume runtime request editing.",
                )
          }
          pricingPath={pricingPath}
          ctaLabel={
            mutationsAllowed
              ? t("dashboard.locked.upgradePlan", "Upgrade plan")
              : t("dashboard.locked.updateBilling", "Update billing")
          }
          badgeLabel={
            mutationsAllowed
              ? t("dashboard.locked.badge", "Locked")
              : t("dashboard.locked.billingIssue", "Billing issue")
          }
        />
      )}
    </div>
  );
}

function isDeveloperToolsProjection(
  payload: SiteDashboardProjectionResponse,
): payload is SiteDeveloperToolsProjection {
  return payload.meta.view === "developer_tools";
}

function buildRuntimeRequestsCopy(t: Translator): RuntimeRequestsCopy {
  return {
    title: t("dashboard.runtimeRequests.title", "Runtime requests"),
    description: t(
      "dashboard.runtimeRequests.description",
      "Standard mode serves translated HTML and proven assets while unconfigured dynamic requests fail locally and are grouped here.",
    ),
    standardMode: t("dashboard.runtimeRequests.standardMode", "Recommended mode"),
    activeRules: t("dashboard.runtimeRequests.activeRules", "Active rules"),
    unreviewedGroups: t("dashboard.runtimeRequests.unreviewedGroups", "Unreviewed groups"),
    highRiskGroups: t("dashboard.runtimeRequests.highRiskGroups", "High risk"),
    lastSeen: t("dashboard.runtimeRequests.lastSeen", "Last seen"),
    policyVersion: t("dashboard.runtimeRequests.policyVersion", "Served policy"),
    propagationReady: t("dashboard.runtimeRequests.propagationReady", "Route cache current"),
    propagationStale: t("dashboard.runtimeRequests.propagationStale", "Route cache stale"),
    observationsTitle: t("dashboard.runtimeRequests.observations.title", "Observed requests"),
    observationsDescription: t(
      "dashboard.runtimeRequests.observations.description",
      "Grouped same-origin runtime requests seen by the serve worker.",
    ),
    observationsDeferred: t(
      "dashboard.runtimeRequests.observations.deferred",
      "Load observed request groups when you need to review them.",
    ),
    observationsEmpty: t(
      "dashboard.runtimeRequests.observations.empty",
      "No dynamic request groups have been observed.",
    ),
    loadObservations: t("dashboard.runtimeRequests.observations.load", "Load observations"),
    loadingObservations: t(
      "dashboard.runtimeRequests.observations.loading",
      "Loading observations",
    ),
    method: t("dashboard.runtimeRequests.table.method", "Method"),
    path: t("dashboard.runtimeRequests.table.path", "Path"),
    likelyType: t("dashboard.runtimeRequests.table.likelyType", "Likely type"),
    firstSeen: t("dashboard.runtimeRequests.table.firstSeen", "First / last seen"),
    seenFromPage: t("dashboard.runtimeRequests.table.seenFromPage", "Seen from page"),
    currentAction: t("dashboard.runtimeRequests.table.currentAction", "Current action"),
    suggestedAction: t("dashboard.runtimeRequests.table.suggestedAction", "Suggested action"),
    risk: t("dashboard.runtimeRequests.table.risk", "Risk"),
    lifecycle: t("dashboard.runtimeRequests.table.lifecycle", "Lifecycle"),
    reviewed: t("dashboard.runtimeRequests.lifecycle.reviewed", "Reviewed"),
    dismissed: t("dashboard.runtimeRequests.lifecycle.dismissed", "Dismissed"),
    ignored: t("dashboard.runtimeRequests.lifecycle.ignored", "Ignored"),
    createRule: t("dashboard.runtimeRequests.createRule", "Create rule"),
    rulesTitle: t("dashboard.runtimeRequests.rules.title", "Policy rules"),
    rulesDescription: t(
      "dashboard.runtimeRequests.rules.description",
      "Keep Standard as the baseline and add narrow rules only for interactive behavior you understand.",
    ),
    noRules: t(
      "dashboard.runtimeRequests.rules.empty",
      "No rules. Standard observe-and-fail is active.",
    ),
    presetsTitle: t("dashboard.runtimeRequests.rules.presets", "Templates"),
    presetNeutralizeAnalytics: t(
      "dashboard.runtimeRequests.rules.preset.neutralizeAnalytics",
      "Neutralize analytics/beacon",
    ),
    presetSearchProxy: t(
      "dashboard.runtimeRequests.rules.preset.searchProxy",
      "Read-only search proxy",
    ),
    presetFeatureConfigProxy: t(
      "dashboard.runtimeRequests.rules.preset.featureConfigProxy",
      "Read-only feature flag/config proxy",
    ),
    presetRouteDataProxy: t(
      "dashboard.runtimeRequests.rules.preset.routeDataProxy",
      "Route-data passthrough candidate",
    ),
    presetFormSubmitProxy: t(
      "dashboard.runtimeRequests.rules.preset.formSubmitProxy",
      "Form submit advanced proxy",
    ),
    validateDraft: t("dashboard.runtimeRequests.rules.validate", "Validate draft"),
    previewReady: t("dashboard.runtimeRequests.preview.ready", "Server validation passed"),
    previewBlocked: t(
      "dashboard.runtimeRequests.preview.blocked",
      "Server validation blocked save",
    ),
    previewRequired: t(
      "dashboard.runtimeRequests.preview.required",
      "Validate the current draft before saving.",
    ),
    save: t("dashboard.runtimeRequests.save", "Save policy"),
    saving: t("dashboard.runtimeRequests.saving", "Saving"),
    saveIncomplete: t(
      "dashboard.runtimeRequests.saveIncomplete",
      "The dashboard could not confirm the saved policy. Review the current policy before trying again.",
    ),
    lifecycleUpdateError: t(
      "dashboard.runtimeRequests.lifecycleUpdateError",
      "Unable to update the request status. Try again or refresh this page.",
    ),
    reset: t("dashboard.runtimeRequests.reset", "Reset draft"),
    enabled: t("dashboard.runtimeRequests.rule.enabled", "Enabled"),
    name: t("dashboard.runtimeRequests.rule.name", "Name"),
    pattern: t("dashboard.runtimeRequests.rule.pattern", "Path pattern"),
    methods: t("dashboard.runtimeRequests.rule.methods", "Methods"),
    action: t("dashboard.runtimeRequests.rule.action", "Action"),
    credentials: t("dashboard.runtimeRequests.rule.credentials", "Credentials"),
    cache: t("dashboard.runtimeRequests.rule.cache", "Cache"),
    limits: t("dashboard.runtimeRequests.rule.limits", "Limits"),
    headers: t("dashboard.runtimeRequests.rule.headers", "Header allowlists"),
    neutralization: t("dashboard.runtimeRequests.rule.neutralization", "Neutralization"),
    confirmations: t("dashboard.runtimeRequests.rule.confirmations", "Advanced confirmations"),
    removeRule: t("dashboard.runtimeRequests.rule.remove", "Remove rule"),
    draftStatus: t("dashboard.runtimeRequests.status.draft", "Draft"),
    savedStatus: t("dashboard.runtimeRequests.status.saved", "Saved"),
    standardValue: t("dashboard.runtimeRequests.standardValue", "Standard"),
    standardFallbackVersion: t("dashboard.runtimeRequests.standardFallbackVersion", "standard-v1"),
    maxBodyBytes: t("dashboard.runtimeRequests.rule.maxBodyBytes", "Max body bytes"),
    maxResponseBytes: t("dashboard.runtimeRequests.rule.maxResponseBytes", "Max response bytes"),
    timeoutMs: t("dashboard.runtimeRequests.rule.timeoutMs", "Timeout ms"),
    requestHeaders: t("dashboard.runtimeRequests.rule.requestHeaders", "Request header allowlist"),
    responseHeaders: t(
      "dashboard.runtimeRequests.rule.responseHeaders",
      "Response header allowlist",
    ),
    requestContentTypes: t(
      "dashboard.runtimeRequests.rule.requestContentTypes",
      "Request content types",
    ),
    responseContentTypes: t(
      "dashboard.runtimeRequests.rule.responseContentTypes",
      "Response content types",
    ),
    redirectScope: t("dashboard.runtimeRequests.rule.redirectScope", "Redirect scope"),
    defaultRuleName: t("dashboard.runtimeRequests.rule.defaultName", "Runtime request rule"),
    previewErrorFallback: t(
      "dashboard.runtimeRequests.preview.errorFallback",
      "Unable to preview runtime request policy.",
    ),
    validationTitle: t("dashboard.runtimeRequests.validation.title", "Validation"),
    warningsTitle: t("dashboard.runtimeRequests.validation.warnings", "Warnings"),
    matchedGroupsTitle: t(
      "dashboard.runtimeRequests.validation.matchedGroups",
      "Matched observations",
    ),
    redactionNote: t(
      "dashboard.runtimeRequests.redactionNote",
      "Details are redacted: no cookies, auth headers, bodies, raw query strings, or sensitive full URLs are shown.",
    ),
  };
}
