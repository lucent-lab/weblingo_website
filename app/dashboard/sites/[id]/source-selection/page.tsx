import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { Button } from "@/components/ui/button";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { fetchSite, WebhooksApiError, type Site } from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import { updateSourceSelectionAction } from "../../../actions";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";
import { SourceSelectionManager, type SourceSelectionCopy } from "./source-selection-manager";

export const metadata = {
  title: "Source selection",
  robots: { index: false, follow: false },
};

type SourceSelectionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SourceSelectionPage({ params }: SourceSelectionPageProps) {
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
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");

  let site: Site | null = null;
  let error: unknown = null;

  try {
    site = await fetchSite(authToken, id);
  } catch (err) {
    error = err;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSite failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSite failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (!site) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load site",
        description:
          "We could not complete your request. You can retry or return to the dashboard.",
        message: "Unable to load source selection.",
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
        deactivateLabel={deactivateLabel}
        reactivateLabel={reactivateLabel}
        deactivateConfirm={deactivateConfirm}
        activateHelpLabel={activateHelpLabel}
        activateHelp={activateHelp}
      />

      {canEdit ? (
        <SourceSelectionManager
          siteId={site.id}
          initialRules={site.routeConfig?.sourceSelection?.rules ?? []}
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
    includeAction: t("dashboard.sourceSelection.rule.include", "Include"),
    excludeAction: t("dashboard.sourceSelection.rule.exclude", "Exclude"),
    addIncludeRule: t("dashboard.sourceSelection.rule.addInclude", "Add include rule"),
    addExcludeRule: t("dashboard.sourceSelection.rule.addExclude", "Add exclude rule"),
    removeRule: t("dashboard.sourceSelection.rule.remove", "Remove rule"),
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
    validationTitle: t("dashboard.sourceSelection.validation.title", "Rules need changes"),
    previewErrorTitle: t("dashboard.sourceSelection.preview.error", "Unable to preview rules."),
    previewLoading: t("dashboard.sourceSelection.preview.loading", "Previewing rules..."),
    previewReady: t("dashboard.sourceSelection.preview.ready", "Preview is current."),
    previewBlocked: t(
      "dashboard.sourceSelection.preview.blocked",
      "Preview failed. Save is blocked.",
    ),
    pagesTitle: t("dashboard.sourceSelection.pages.title", "Known source pages"),
    pagesDescription: t(
      "dashboard.sourceSelection.pages.description",
      "The tree is derived from previewed source paths; include/exclude decisions come from the backend response.",
    ),
    pagesEmpty: t("dashboard.sourceSelection.pages.empty", "No known pages returned by preview."),
    pageColumn: t("dashboard.sourceSelection.pages.column.page", "Path"),
    stateColumn: t("dashboard.sourceSelection.pages.column.state", "State"),
    reasonColumn: t("dashboard.sourceSelection.pages.column.reason", "Reason"),
    actionsColumn: t("dashboard.sourceSelection.pages.column.actions", "Actions"),
    selected: t("dashboard.sourceSelection.state.selected", "Selected"),
    excluded: t("dashboard.sourceSelection.state.excluded", "Excluded"),
    mixed: t("dashboard.sourceSelection.state.mixed", "Mixed"),
    defaultState: t("dashboard.sourceSelection.state.default", "Default"),
    direct: t("dashboard.sourceSelection.state.direct", "Direct"),
    inherited: t("dashboard.sourceSelection.state.inherited", "Inherited"),
    changed: t("dashboard.sourceSelection.state.changed", "Changed"),
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
