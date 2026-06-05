import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { Button } from "@/components/ui/button";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import {
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type SiteDashboardProjectionResponse,
  type SourceSelectionRule,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, type Translator } from "@internal/i18n";

import { updateSourceSelectionAction } from "../../../actions";
import {
  buildSiteHeaderAccess,
  buildSiteHeaderLabels,
  localizeDashboardRouteHref,
  resolveDashboardRouteLocale,
  type DashboardRouteSearchParams,
} from "../focused-route-utils";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";
import { SourceSelectionManager, type SourceSelectionCopy } from "./source-selection-manager";

type SiteSourceSelectionProjection = Extract<
  SiteDashboardProjectionResponse,
  { meta: { view: "source_selection" } }
>;

export const metadata = {
  title: "Source selection",
  robots: { index: false, follow: false },
};

type SourceSelectionPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DashboardRouteSearchParams>;
};

export default async function SourceSelectionPage({
  params,
  searchParams,
}: SourceSelectionPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  if (!isDashboardAuthScopedToSite(auth, id)) {
    notFound();
  }
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const routeLocale = resolveDashboardRouteLocale(
    resolvedSearchParams,
    (await headers()).get("accept-language"),
  );
  const locale = routeLocale.locale;
  const dashboardLocale = routeLocale.dashboardLocale;
  const pricingPath = `/${locale}/pricing`;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const siteHeaderAccess = buildSiteHeaderAccess({ has: auth.has, mutationsAllowed });
  const canEdit = siteHeaderAccess.canEdit;
  const headerLabels = buildSiteHeaderLabels(t);

  let projection: SiteSourceSelectionProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "source_selection");
    projection = isSourceSelectionProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetch source selection projection failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetch source selection projection failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (!projection) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load site",
        description: "We could not load source selection rules. No rule changes were saved.",
        message: "Unable to load source selection.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          nextSteps={errorView.nextSteps}
          referenceCode={errorView.referenceCode}
          technicalDetails={errorView.technicalDetails}
          actions={
            <>
              <DashboardRetryButton
                href={
                  localizeDashboardRouteHref(
                    `/dashboard/sites/${id}/source-selection`,
                    dashboardLocale,
                  )!
                }
                label="Retry source selection"
              />
              <Button asChild variant="outline">
                <Link href={localizeDashboardRouteHref(`/dashboard/sites/${id}`, dashboardLocale)!}>
                  Site overview
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard home</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="mailto:contact@weblingo.app?subject=Dashboard%20source%20selection%20unavailable">
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

  const initialSourceSelectionRules = projection.policy.rules
    .map(toEditableSourceSelectionRule)
    .filter((rule): rule is SourceSelectionRule => rule !== null);
  const hasUnsupportedSourceSelectionRules =
    projection.policy.rules.length !== initialSourceSelectionRules.length;

  return (
    <div className="space-y-8">
      <SiteHeader
        site={projection.site}
        canEdit={canEdit}
        canPauseTranslations={siteHeaderAccess.canPauseTranslations}
        canResumeTranslations={siteHeaderAccess.canResumeTranslations}
        deactivateLabel={headerLabels.deactivateLabel}
        reactivateLabel={headerLabels.reactivateLabel}
        deactivateConfirm={headerLabels.deactivateConfirm}
        activateHelpLabel={headerLabels.activateHelpLabel}
        activateHelp={headerLabels.activateHelp}
        dashboardLocale={dashboardLocale}
      />

      {canEdit && hasUnsupportedSourceSelectionRules ? (
        <ErrorStateCard
          title={t(
            "dashboard.sourceSelection.unsupported.title",
            "Unsupported source-selection rules",
          )}
          description={t(
            "dashboard.sourceSelection.unsupported.description",
            "This site has source-selection rules that this editor does not support yet.",
          )}
          message={t(
            "dashboard.sourceSelection.unsupported.message",
            "Editing is blocked to avoid deleting unsupported rules.",
          )}
        />
      ) : canEdit ? (
        <SourceSelectionManager
          siteId={projection.site.id}
          initialRules={initialSourceSelectionRules}
          routeConfigUpdatedAt={projection.preconditions.expectedRouteConfigUpdatedAt ?? null}
          sourceSelectionFingerprint={
            projection.preconditions.expectedSourceSelectionFingerprint ?? null
          }
          canEdit={canEdit}
          saveAction={updateSourceSelectionAction}
          copy={buildSourceSelectionCopy(t)}
        />
      ) : (
        <LockedFeatureCard
          title={t("dashboard.sourceSelection.locked.title", "Source selection")}
          description={
            mutationsAllowed
              ? t(
                  "dashboard.sourceSelection.locked.upgrade",
                  "Upgrade to choose which source pages WebLingo translates.",
                )
              : t(
                  "dashboard.sourceSelection.locked.billing",
                  "Update billing to resume source-selection editing.",
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

function isSourceSelectionProjection(
  payload: SiteDashboardProjectionResponse,
): payload is SiteSourceSelectionProjection {
  return payload.meta.view === "source_selection";
}

function buildSourceSelectionCopy(t: Translator): SourceSelectionCopy {
  return {
    title: t("dashboard.sourceSelection.title", "Source selection"),
    description: t(
      "dashboard.sourceSelection.description",
      "Preview and save the flat include/exclude rules that decide which discovered source pages enter translation planning.",
    ),
    persistedTitle: t("dashboard.sourceSelection.persisted.title", "Current saved rules"),
    persistedDescription: t(
      "dashboard.sourceSelection.persisted.description",
      "These are the rules currently persisted on the site config.",
    ),
    proposedTitle: t("dashboard.sourceSelection.proposed.title", "Proposed changes"),
    proposedDescription: t(
      "dashboard.sourceSelection.proposed.description",
      "Edits are previewed against known pages before saving.",
    ),
    noRules: t("dashboard.sourceSelection.noRules", "No rules. Unmatched pages are included."),
    unsavedChanges: t("dashboard.sourceSelection.unsaved", "Unsaved changes"),
    inSync: t("dashboard.sourceSelection.inSync", "Saved state"),
    actionLabel: t("dashboard.sourceSelection.rule.action", "Action"),
    patternLabel: t("dashboard.sourceSelection.rule.pattern", "Pattern"),
    patternPlaceholder: t("dashboard.sourceSelection.rule.patternPlaceholder", "/blog/*"),
    includeAction: t("dashboard.sourceSelection.rule.include", "Include"),
    excludeAction: t("dashboard.sourceSelection.rule.exclude", "Exclude"),
    addIncludeRule: t("dashboard.sourceSelection.rule.addInclude", "Add include rule"),
    addExcludeRule: t("dashboard.sourceSelection.rule.addExclude", "Add exclude rule"),
    removeRule: t("dashboard.sourceSelection.rule.remove", "Remove rule"),
    ruleLimitLabel: t("dashboard.sourceSelection.rule.limitLabel", "{count}/{limit} rules used"),
    ruleLimitHelp: t(
      "dashboard.sourceSelection.rule.limitHelp",
      "Use section rules like /blog/* to keep the rule set compact.",
    ),
    ruleLimitNear: t(
      "dashboard.sourceSelection.rule.limitNear",
      "Near the 200-rule limit. Prefer section rules before adding more page rules.",
    ),
    ruleChangeNew: t("dashboard.sourceSelection.rule.changeNew", "New"),
    ruleChangeEdited: t("dashboard.sourceSelection.rule.changeEdited", "Edited"),
    ruleChangeRemoved: t("dashboard.sourceSelection.rule.changeRemoved", "Removed on save"),
    summaryTitle: t("dashboard.sourceSelection.summary.title", "Preview summary"),
    summaryDescription: t(
      "dashboard.sourceSelection.summary.description",
      "Counts come from the backend preview resolver for the proposed flat rules.",
    ),
    knownIncluded: t("dashboard.sourceSelection.summary.knownIncluded", "Known included"),
    knownExcluded: t("dashboard.sourceSelection.summary.knownExcluded", "Known excluded"),
    includedByDefault: t("dashboard.sourceSelection.summary.includedByDefault", "Default include"),
    includedByRule: t("dashboard.sourceSelection.summary.includedByRule", "Included by rule"),
    excludedByRule: t("dashboard.sourceSelection.summary.excludedByRule", "Excluded by rule"),
    notIncludedByRule: t(
      "dashboard.sourceSelection.summary.notIncludedByRule",
      "Not included by rule",
    ),
    rulesTotal: t("dashboard.sourceSelection.summary.rulesTotal", "Rules"),
    warningsTitle: t("dashboard.sourceSelection.warnings.title", "Preview warnings"),
    impactTitle: t("dashboard.sourceSelection.impact.title", "High-impact preview"),
    selectedToExcludedWarning: t(
      "dashboard.sourceSelection.impact.selectedToExcluded",
      "{count} currently selected known source pages would be excluded by this draft.",
    ),
    activeSiteRerunWarning: t(
      "dashboard.sourceSelection.impact.activeSiteRerun",
      "Saving these rules on an active site will enqueue the existing site refresh flow for {count} active deployments.",
    ),
    validationTitle: t("dashboard.sourceSelection.validation.title", "Rules need changes"),
    previewErrorTitle: t("dashboard.sourceSelection.preview.error", "Unable to preview rules."),
    previewLoading: t("dashboard.sourceSelection.preview.loading", "Previewing rules..."),
    previewReady: t("dashboard.sourceSelection.preview.ready", "Preview is current."),
    previewBlocked: t(
      "dashboard.sourceSelection.preview.blocked",
      "Preview failed. Save is blocked.",
    ),
    preview: t("dashboard.sourceSelection.preview.action", "Preview source paths"),
    pagesTitle: t("dashboard.sourceSelection.pages.title", "Known source pages"),
    pagesDescription: t(
      "dashboard.sourceSelection.pages.description",
      "The tree, search, and include/exclude decisions come from the backend preview response.",
    ),
    pagesEmpty: t("dashboard.sourceSelection.pages.empty", "No known pages returned by preview."),
    filterLabel: t("dashboard.sourceSelection.filter.label", "Search source paths"),
    filterPlaceholder: t("dashboard.sourceSelection.filter.placeholder", "/blog"),
    filterHelp: t(
      "dashboard.sourceSelection.filter.help",
      "Searches globally across known backend source paths.",
    ),
    filterMinLength: t(
      "dashboard.sourceSelection.filter.minLength",
      "Enter at least {count} characters to search.",
    ),
    filterNoResults: t(
      "dashboard.sourceSelection.filter.noResults",
      "No backend source paths match the search.",
    ),
    clearFilter: t("dashboard.sourceSelection.filter.clear", "Clear filter"),
    inventoryNote: t(
      "dashboard.sourceSelection.inventory.note",
      "This view shows known discovered source paths returned by preview. It is not a live crawl of every possible origin URL.",
    ),
    partialInventoryNote: t(
      "dashboard.sourceSelection.inventory.partial",
      "This preview is limited to a backend-bounded sample so it stays responsive on large sites. Use search or open a narrower folder to inspect more paths.",
    ),
    currentFolder: t("dashboard.sourceSelection.tree.currentFolder", "Current folder"),
    parentFolder: t("dashboard.sourceSelection.tree.parentFolder", "Parent folder"),
    rootFolder: t("dashboard.sourceSelection.tree.rootFolder", "Root"),
    openFolder: t("dashboard.sourceSelection.tree.openFolder", "Open folder"),
    pageColumn: t("dashboard.sourceSelection.pages.column.page", "Path"),
    stateColumn: t("dashboard.sourceSelection.pages.column.state", "State"),
    reasonColumn: t("dashboard.sourceSelection.pages.column.reason", "Reason"),
    actionsColumn: t("dashboard.sourceSelection.pages.column.actions", "Actions"),
    selected: t("dashboard.sourceSelection.state.selected", "Selected"),
    selectedOnPage: t(
      "dashboard.sourceSelection.state.selectedOnPage",
      "Selected on this preview page",
    ),
    excluded: t("dashboard.sourceSelection.state.excluded", "Excluded"),
    mixed: t("dashboard.sourceSelection.state.mixed", "Mixed"),
    defaultState: t("dashboard.sourceSelection.state.default", "Default"),
    direct: t("dashboard.sourceSelection.state.direct", "Direct"),
    inherited: t("dashboard.sourceSelection.state.inherited", "Inherited"),
    changed: t("dashboard.sourceSelection.state.changed", "Changed"),
    changedOnPage: t(
      "dashboard.sourceSelection.state.changedOnPage",
      "{count} changed on this preview page",
    ),
    matchedPattern: t("dashboard.sourceSelection.pattern.matched", "Matched"),
    noMatchedPattern: t("dashboard.sourceSelection.pattern.none", "No matched rule"),
    includePage: t("dashboard.sourceSelection.action.includePage", "Include page"),
    excludePage: t("dashboard.sourceSelection.action.excludePage", "Exclude page"),
    inheritPage: t("dashboard.sourceSelection.action.inheritPage", "Clear page rule"),
    includeDescendants: t("dashboard.sourceSelection.action.includeDescendants", "Include section"),
    excludeDescendants: t("dashboard.sourceSelection.action.excludeDescendants", "Exclude section"),
    inheritDescendants: t(
      "dashboard.sourceSelection.action.inheritDescendants",
      "Clear section rule",
    ),
    descendantsHelp: t(
      "dashboard.sourceSelection.help.descendants",
      "Section controls save a /* rule and apply to future descendants.",
    ),
    exactHelp: t(
      "dashboard.sourceSelection.help.exact",
      "Page controls save an exact path rule for this page only.",
    ),
    previousPage: t("dashboard.sourceSelection.pagination.previous", "Previous"),
    nextPage: t("dashboard.sourceSelection.pagination.next", "Next"),
    paginationLabel: t(
      "dashboard.sourceSelection.pagination.label",
      "{start}-{end} of {total} previewed paths",
    ),
    save: t("dashboard.sourceSelection.save", "Save source selection"),
    saving: t("dashboard.sourceSelection.saving", "Saving..."),
    saveDisabled: t(
      "dashboard.sourceSelection.saveDisabled",
      "Save after the current proposed rules preview successfully.",
    ),
    saveIncomplete: t(
      "dashboard.sourceSelection.saveIncomplete",
      "The dashboard could not confirm the saved source selection. Review the current rules before trying again.",
    ),
    saved: t("dashboard.sourceSelection.saved", "Source selection saved."),
    reset: t("dashboard.sourceSelection.reset", "Reset changes"),
    reasonLabels: {
      included_by_default: t(
        "dashboard.sourceSelection.reason.includedByDefault",
        "Included by default",
      ),
      included_by_rule: t("dashboard.sourceSelection.reason.includedByRule", "Included by rule"),
      excluded_by_rule: t("dashboard.sourceSelection.reason.excludedByRule", "Excluded by rule"),
      canonicalized_by_rule: t(
        "dashboard.sourceSelection.reason.canonicalizedByRule",
        "Canonicalized by rule",
      ),
      not_included_by_rule: t(
        "dashboard.sourceSelection.reason.notIncludedByRule",
        "Excluded because include rules create an allowlist",
      ),
    },
  };
}

function toEditableSourceSelectionRule(
  rule: SiteSourceSelectionProjection["policy"]["rules"][number],
): SourceSelectionRule | null {
  if (rule.kind !== "include" && rule.kind !== "exclude") {
    return null;
  }
  return {
    action: rule.kind,
    pattern: rule.pattern,
  };
}
