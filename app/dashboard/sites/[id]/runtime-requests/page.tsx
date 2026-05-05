import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { Button } from "@/components/ui/button";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import {
  fetchSite,
  listRuntimeRequestObservations,
  WebhooksApiError,
  type RuntimeRequestObservationGroup,
  type Site,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import {
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

export default async function RuntimeRequestsPage({ params }: RuntimeRequestsPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;

  let site: Site | null = null;
  let observations: RuntimeRequestObservationGroup[] = [];
  let error: unknown = null;

  try {
    site = await fetchSite(authToken, id);
    const observationResponse = await listRuntimeRequestObservations(authToken, id, {
      limit: 50,
      lifecycle: "all",
      sort: "last_seen_desc",
    });
    observations = observationResponse.groups;
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

  if (!site) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load runtime requests",
        description:
          "We could not complete your request. You can retry or return to the dashboard.",
        message: "Unable to load runtime requests.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      );
    }
    notFound();
  }

  return (
    <div className="space-y-8">
      <SiteHeader
        site={site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        deactivateLabel={t("dashboard.site.status.deactivate")}
        reactivateLabel={t("dashboard.site.status.reactivate")}
        deactivateConfirm={t("dashboard.site.status.deactivateConfirm")}
        activateHelpLabel={t("dashboard.site.status.activateHelpLabel")}
        activateHelp={t("dashboard.site.status.activateHelp")}
      />

      {canEdit ? (
        <RuntimeRequestsManager
          siteId={site.id}
          initialPolicy={site.routeConfig?.runtimeRequestPolicy}
          runtimeRequestPolicyFingerprint={
            site.routeConfig?.runtimeRequestPolicyFingerprint ?? null
          }
          runtimeRequestPolicyVersion={site.routeConfig?.runtimeRequestPolicyVersion ?? null}
          propagation={site.routeConfig?.runtimeRequestPolicyPropagation ?? null}
          observations={observations}
          canEdit={canEdit}
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
    observationsEmpty: t(
      "dashboard.runtimeRequests.observations.empty",
      "No dynamic request groups have been observed.",
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
