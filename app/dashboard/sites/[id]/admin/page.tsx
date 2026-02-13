import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Info } from "lucide-react";

import { SiteAdminForm } from "./site-admin-form";

import { ActionForm } from "@/components/dashboard/action-form";

import {
  activateSiteAction,
  cancelTranslationRunAction,
  deactivateSiteAction,
  setLocaleServingAction,
  translateAndServeAction,
  triggerCrawlAction,
} from "../../../actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached, listSupportedLanguagesCached } from "@internal/dashboard/data";
import { deriveSiteSettingsAccess } from "@internal/dashboard/site-settings";
import {
  fetchDeployments,
  fetchSite,
  type Deployment,
  type Site,
  type SupportedLanguage,
} from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Site settings",
  robots: { index: false, follow: false },
};

type SiteAdminPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SiteAdminPage({ params }: SiteAdminPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const settingsAccess = deriveSiteSettingsAccess({
    has: auth.has,
    mutationsAllowed: auth.mutationsAllowed,
  });
  const billingBlocked = settingsAccess.billingBlocked;
  const canDeactivate = auth.has({ feature: "edit" }) && !billingBlocked;
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && !billingBlocked;
  const canActivate = auth.has({ feature: "edit" }) && !billingBlocked;
  const canToggleServing = auth.has({ allFeatures: ["edit", "serve"] }) && !billingBlocked;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let activeSiteCount: number | null = null;
  let error: string | null = null;
  let supportedLanguages: SupportedLanguage[] = [];

  // Parallelize all API fetches - optimistic that site exists (the common case)
  const [siteResult, deploymentsResult, sitesResult, supportedLanguagesResult] =
    await Promise.allSettled([
      fetchSite(auth.webhooksAuth!, id),
      fetchDeployments(auth.webhooksAuth!, id),
      listSitesCached(auth.webhooksAuth!),
      settingsAccess.canEditLocales ? listSupportedLanguagesCached() : Promise.resolve([]),
    ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    error =
      siteResult.reason instanceof Error
        ? siteResult.reason.message
        : "Unable to load site settings.";
  }

  if (deploymentsResult.status === "fulfilled") {
    deployments = deploymentsResult.value;
  } else {
    console.warn("[dashboard] fetchDeployments failed:", deploymentsResult.reason);
  }

  if (sitesResult.status === "fulfilled") {
    activeSiteCount = sitesResult.value.filter((entry) => entry.status === "active").length;
  } else {
    console.warn("[dashboard] listSites failed while checking slots:", sitesResult.reason);
  }

  if (supportedLanguagesResult.status === "fulfilled") {
    supportedLanguages = supportedLanguagesResult.value;
  }

  if (!site) {
    if (error) {
      return (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load site</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline" href="/dashboard/sites">
              Back to sites
            </Link>
          </CardContent>
        </Card>
      );
    }
    notFound();
  }

  const displayLocale = pickPreferredLocale((await headers()).get("accept-language") ?? "");
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const localeAliases = site.locales.reduce<Record<string, string | null>>((acc, locale) => {
    acc[locale.targetLang] = locale.alias ?? null;
    return acc;
  }, {});
  const verifiedDomains = site.domains.filter((domain) => domain.status === "verified").length;
  const hasVerifiedDomain = verifiedDomains > 0;
  const servingLive = deployments.some((deployment) => deployment.servingStatus === "serving");
  const crawlReady = site.status === "active";
  const firstVerifiedDomain =
    site.domains.find((domain) => domain.status === "verified")?.domain ?? null;
  const firstServingDomain =
    deployments.find((deployment) => deployment.servingStatus === "serving" && deployment.domain)
      ?.domain ?? firstVerifiedDomain;
  const siteProfile = site.siteProfile ?? {};
  const brandVoice =
    typeof siteProfile.brandVoice === "string" ? siteProfile.brandVoice : undefined;
  const siteProfileNotes =
    typeof siteProfile.description === "string" ? siteProfile.description : undefined;
  const maxSites = auth.account?.featureFlags.maxSites ?? null;
  const planLabel = formatPlanLabel(auth.account?.planType ?? null);
  const slotSummary = buildSlotSummary(activeSiteCount, maxSites, planLabel);
  const deploymentsTitle = t("dashboard.deployments.title");
  const deploymentsDescription = t("dashboard.deployments.description");
  const deploymentsEmpty = t("dashboard.deployments.empty");
  const deploymentLanguageLabel = t("dashboard.deployments.language");
  const deploymentStatusLabel = t("dashboard.deployments.status.label");
  const deploymentStatusHelpLabel = t("dashboard.deployments.status.helpLabel");
  const deploymentStatusHelp = t("dashboard.deployments.status.help");
  const deploymentIdLabel = t("dashboard.deployments.id.label");
  const deploymentIdHelpLabel = t("dashboard.deployments.id.helpLabel");
  const deploymentIdHelp = t("dashboard.deployments.id.help");
  const activeDeploymentLabel = t("dashboard.deployments.activeId.label");
  const activeDeploymentHelpLabel = t("dashboard.deployments.activeId.helpLabel");
  const activeDeploymentHelp = t("dashboard.deployments.activeId.help");
  const deploymentRouteLabel = t("dashboard.deployments.route.label");
  const deploymentRouteHelpLabel = t("dashboard.deployments.route.helpLabel");
  const deploymentRouteHelp = t("dashboard.deployments.route.help");
  const servingLanguagesTitle = t("dashboard.serving.languages.title");
  const servingLanguagesDescription = t("dashboard.serving.languages.description");
  const servingLanguageLabel = t("dashboard.serving.languages.columns.language");
  const servingDomainLabel = t("dashboard.serving.languages.columns.domain");
  const servingStatusLabel = t("dashboard.serving.languages.columns.serving");
  const servingActionLabel = t("dashboard.serving.languages.columns.action");
  const servingStatusLabels = {
    inactive: t("dashboard.serving.status.inactive"),
    disabled: t("dashboard.serving.status.disabled"),
    needs_domain: t("dashboard.serving.status.needsDomain"),
    ready: t("dashboard.serving.status.ready"),
    serving: t("dashboard.serving.status.serving"),
  };
  const servingActionTranslate = t("dashboard.serving.action.translate");
  const servingActionVerify = t("dashboard.serving.action.verify");
  const servingActionEnable = t("dashboard.serving.action.enable");
  const servingActionDisable = t("dashboard.serving.action.disable");
  const servingActionView = t("dashboard.serving.action.view");
  const crawlCaptureTitle = t("dashboard.site.settings.crawlCapture.title");
  const crawlCaptureDescription = t("dashboard.site.settings.crawlCapture.description");
  const crawlCaptureLabel = t("dashboard.site.settings.crawlCapture.label");
  const crawlCaptureHelp = t("dashboard.site.settings.crawlCapture.help");
  const crawlCaptureOptionTemplatePlusHydrated = t(
    "dashboard.site.settings.crawlCapture.option.template_plus_hydrated",
  );
  const crawlCaptureOptionTemplateOnly = t(
    "dashboard.site.settings.crawlCapture.option.template_only",
  );
  const crawlCaptureOptionHydratedOnly = t(
    "dashboard.site.settings.crawlCapture.option.hydrated_only",
  );
  const clientRuntimeTitle = t("dashboard.site.settings.clientRuntime.title");
  const clientRuntimeDescription = t("dashboard.site.settings.clientRuntime.description");
  const clientRuntimeLabel = t("dashboard.site.settings.clientRuntime.label");
  const clientRuntimeHelp = t("dashboard.site.settings.clientRuntime.help");
  const spaRefreshTitle = t("dashboard.site.settings.spaRefresh.title");
  const spaRefreshDescription = t("dashboard.site.settings.spaRefresh.description");
  const spaRefreshLabel = t("dashboard.site.settings.spaRefresh.label");
  const spaRefreshHelp = t("dashboard.site.settings.spaRefresh.help");
  const spaRefreshNote = t("dashboard.site.settings.spaRefresh.note");
  const spaRefreshMissingFallbackLabel = t(
    "dashboard.site.settings.spaRefresh.missingFallback.label",
  );
  const spaRefreshMissingFallbackHelp = t(
    "dashboard.site.settings.spaRefresh.missingFallback.help",
  );
  const spaRefreshErrorFallbackLabel = t("dashboard.site.settings.spaRefresh.errorFallback.label");
  const spaRefreshErrorFallbackHelp = t("dashboard.site.settings.spaRefresh.errorFallback.help");
  const spaRefreshSectionScopeLabel = t("dashboard.site.settings.spaRefresh.sectionScope.label");
  const spaRefreshSectionScopeHelp = t("dashboard.site.settings.spaRefresh.sectionScope.help");
  const spaRefreshOptionGlobalOnly = t("dashboard.site.settings.spaRefresh.option.globalOnly");
  const spaRefreshOptionBaseline = t("dashboard.site.settings.spaRefresh.option.baseline");
  const translatableAttributesTitle = t("dashboard.site.settings.translatableAttributes.title");
  const translatableAttributesDescription = t(
    "dashboard.site.settings.translatableAttributes.description",
  );
  const translatableAttributesLabel = t("dashboard.site.settings.translatableAttributes.label");
  const translatableAttributesHelp = t("dashboard.site.settings.translatableAttributes.help");
  const translatableAttributesPlaceholder = t(
    "dashboard.site.settings.translatableAttributes.placeholder",
  );
  const lockedHelp = t("dashboard.site.settings.lockedHelp");
  const maxDailySiteCrawls = auth.account?.featureFlags.maxDailyRecrawls ?? null;
  const siteCrawlsUsed = auth.account?.dailyCrawlUsage?.siteCrawls ?? 0;
  const siteCrawlsRemaining =
    maxDailySiteCrawls === null ? null : Math.max(maxDailySiteCrawls - siteCrawlsUsed, 0);
  const siteCrawlLimitReached = maxDailySiteCrawls !== null && siteCrawlsUsed >= maxDailySiteCrawls;
  const siteCrawlLimitLabel =
    maxDailySiteCrawls === null ? "Unlimited" : `${maxDailySiteCrawls} per day`;
  const siteCrawlRemainingLabel =
    maxDailySiteCrawls === null ? "Unlimited" : `${siteCrawlsRemaining} remaining today`;
  const slotCheckUnavailable = maxSites !== null && activeSiteCount === null;
  const hasAvailableSlot =
    maxSites === null || activeSiteCount === null || activeSiteCount < maxSites;
  const activationDisabled = !hasAvailableSlot || !canActivate;
  const hasLockedSections =
    !settingsAccess.canEditBasics ||
    !settingsAccess.canEditLocales ||
    !settingsAccess.canEditServingMode ||
    !settingsAccess.canEditCrawlCaptureMode ||
    !settingsAccess.canEditClientRuntime ||
    !settingsAccess.canEditSpaRefresh ||
    !settingsAccess.canEditTranslatableAttributes ||
    !settingsAccess.canEditProfile;
  const deploymentsByLang = new Map(
    deployments.map((deployment) => [deployment.targetLang, deployment]),
  );
  const servingRows = targetLangs
    .map((lang) => deploymentsByLang.get(lang))
    .filter((deployment): deployment is Deployment => Boolean(deployment));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Site settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage languages, routing, and translation context for this site.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/sites/${site.id}`}>Back to site</Link>
        </Button>
      </div>

      {billingBlocked || hasLockedSections ? (
        <Card className="border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle>
              {billingBlocked ? "Billing action required" : "Some settings are locked"}
            </CardTitle>
            <CardDescription>
              {billingBlocked
                ? "Update billing to resume editing this site."
                : "Upgrade your plan to edit locked sections."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={pricingPath}>{billingBlocked ? "Update billing" : "Upgrade plan"}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/dashboard/sites/${site.id}`}>Back to site</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <SiteAdminForm
        siteId={site.id}
        sourceUrl={site.sourceUrl}
        sourceLang={site.locales[0]?.sourceLang ?? ""}
        targets={targetLangs}
        aliases={localeAliases}
        pattern={site.routeConfig?.pattern ?? null}
        maxLocales={site.maxLocales ?? null}
        servingMode={site.servingMode}
        crawlCaptureMode={site.routeConfig?.crawlCaptureMode ?? "template_plus_hydrated"}
        crawlCaptureCopy={{
          title: crawlCaptureTitle,
          description: crawlCaptureDescription,
          label: crawlCaptureLabel,
          help: crawlCaptureHelp,
          options: {
            templatePlusHydrated: crawlCaptureOptionTemplatePlusHydrated,
            templateOnly: crawlCaptureOptionTemplateOnly,
            hydratedOnly: crawlCaptureOptionHydratedOnly,
          },
        }}
        clientRuntimeEnabled={site.routeConfig?.clientRuntimeEnabled ?? true}
        clientRuntimeCopy={{
          title: clientRuntimeTitle,
          description: clientRuntimeDescription,
          label: clientRuntimeLabel,
          help: clientRuntimeHelp,
        }}
        spaRefresh={site.routeConfig?.spaRefresh ?? null}
        spaRefreshCopy={{
          title: spaRefreshTitle,
          description: spaRefreshDescription,
          label: spaRefreshLabel,
          help: spaRefreshHelp,
          note: spaRefreshNote,
          missingFallbackLabel: spaRefreshMissingFallbackLabel,
          missingFallbackHelp: spaRefreshMissingFallbackHelp,
          errorFallbackLabel: spaRefreshErrorFallbackLabel,
          errorFallbackHelp: spaRefreshErrorFallbackHelp,
          sectionScopeLabel: spaRefreshSectionScopeLabel,
          sectionScopeHelp: spaRefreshSectionScopeHelp,
          optionGlobalOnly: spaRefreshOptionGlobalOnly,
          optionBaseline: spaRefreshOptionBaseline,
        }}
        translatableAttributes={site.routeConfig?.translatableAttributes ?? null}
        translatableAttributesCopy={{
          title: translatableAttributesTitle,
          description: translatableAttributesDescription,
          label: translatableAttributesLabel,
          help: translatableAttributesHelp,
          placeholder: translatableAttributesPlaceholder,
        }}
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
        displayLocale={displayLocale}
        initialBrandVoice={brandVoice}
        initialSiteProfileNotes={siteProfileNotes}
      />

      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle>Localization</CardTitle>
          <CardDescription>
            Active sites serve localized pages and count toward your plan limit. Paused sites keep
            translations but stop serving and free the slot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slotSummary ? (
            <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground">
              {slotSummary}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Localization status:{" "}
              <span className="font-semibold text-foreground">
                {site.status === "active" ? "Enabled" : "Paused"}
              </span>
            </p>
            {site.status === "active" ? (
              canDeactivate ? (
                <ActionForm
                  action={deactivateSiteAction}
                  loading="Pausing localization..."
                  success="Localization paused."
                  error="Unable to pause localization."
                  refreshOnSuccess={true}
                >
                  <>
                    <input name="siteId" type="hidden" value={site.id} />
                    <Button type="submit" variant="destructive">
                      Pause localization
                    </Button>
                  </>
                </ActionForm>
              ) : (
                <Button variant="outline" disabled>
                  Pause localization
                </Button>
              )
            ) : canActivate ? (
              <ActionForm
                action={activateSiteAction}
                loading="Enabling localization..."
                success="Localization enabled."
                error="Unable to enable localization."
                refreshOnSuccess={true}
              >
                <>
                  <input name="siteId" type="hidden" value={site.id} />
                  <Button type="submit" variant="outline" disabled={activationDisabled}>
                    Enable localization
                  </Button>
                </>
              </ActionForm>
            ) : (
              <Button variant="outline" disabled>
                Enable localization
              </Button>
            )}
          </div>
          <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Serving:</span>{" "}
            {hasVerifiedDomain
              ? `${verifiedDomains} verified domain(s). Serving turns on after publish.`
              : "Off until you verify at least one domain."}
          </div>
          {site.status === "inactive" && !hasAvailableSlot ? (
            <p className="text-xs text-destructive">
              No active site slots available. Pause localization for another site or upgrade your
              plan to add more.
            </p>
          ) : null}
          {site.status === "inactive" && slotCheckUnavailable ? (
            <p className="text-xs text-muted-foreground">
              We could not verify slot availability right now. We will validate when you enable
              localization.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Paused sites do not count toward your active site limit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serving</CardTitle>
          <CardDescription>
            Serve translated pages on verified domains after a successful publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Serving status:{" "}
              <span className="font-semibold text-foreground">
                {servingLive
                  ? "Live"
                  : site.status !== "active"
                    ? "Off (localization paused)"
                    : hasVerifiedDomain
                      ? "Ready to publish"
                      : "Off (verify domain)"}
              </span>
            </p>
            {servingLive && firstServingDomain ? (
              <Button asChild variant="outline">
                <Link
                  href={`https://${firstServingDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  title={servingActionView}
                >
                  View live site
                </Link>
              </Button>
            ) : site.status !== "active" ? (
              <Button variant="outline" disabled title="Enable localization first">
                Enable localization first
              </Button>
            ) : !hasVerifiedDomain ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/sites/${site.id}#domains`} title={servingActionVerify}>
                  Verify a domain
                </Link>
              </Button>
            ) : canCrawl ? (
              <ActionForm
                action={triggerCrawlAction}
                loading="Starting crawl..."
                success="Crawl enqueued."
                error="Unable to start crawl."
                refreshOnSuccess={false}
              >
                <>
                  <input name="siteId" type="hidden" value={site.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={siteCrawlLimitReached}
                    title={
                      siteCrawlLimitReached ? "Daily site crawl limit reached." : "Start serving"
                    }
                  >
                    Start serving
                  </Button>
                </>
              </ActionForm>
            ) : (
              <Button variant="outline" disabled title="Start serving">
                Start serving
              </Button>
            )}
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {servingLive
              ? "Serving translated pages on verified domains."
              : siteCrawlLimitReached
                ? "Daily crawl limit reached. Try again tomorrow or upgrade your plan."
                : site.status !== "active"
                  ? "Enable localization to generate translations before serving."
                  : hasVerifiedDomain
                    ? "Run a crawl to publish the latest translations and start serving them."
                    : "Verify at least one domain to start serving translated pages."}
          </div>
          {servingRows.length ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{servingLanguagesTitle}</p>
                <p className="text-xs text-muted-foreground">{servingLanguagesDescription}</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">{servingLanguageLabel}</th>
                      <th className="px-3 py-2 text-left">{servingDomainLabel}</th>
                      <th className="px-3 py-2 text-left">{servingStatusLabel}</th>
                      <th className="px-3 py-2 text-right">{servingActionLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servingRows.map((deployment) => {
                      const domainStatus = deployment.domainStatus ?? null;
                      const servingLabel =
                        servingStatusLabels[deployment.servingStatus] ?? deployment.servingStatus;
                      const servingVariant = resolveServingStatusVariant(deployment.servingStatus);
                      const domainVariant = resolveDomainStatusVariant(domainStatus);
                      const canStartServing = canCrawl && !siteCrawlLimitReached;
                      const canManageTranslations = canCrawl;
                      const toggleLabel = deployment.serveEnabled
                        ? servingActionDisable
                        : servingActionEnable;
                      const toggleValue = deployment.serveEnabled ? "false" : "true";
                      const showToggle = deployment.servingStatus !== "inactive";
                      return (
                        <tr
                          key={`${deployment.targetLang}-${deployment.domain ?? "domain"}`}
                          className="border-t border-border/50"
                        >
                          <td className="px-3 py-3 align-top font-semibold text-foreground">
                            {deployment.targetLang.toUpperCase()}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="text-foreground">{deployment.domain ?? "—"}</span>
                              {domainStatus ? (
                                <Badge variant={domainVariant}>{domainStatus}</Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Badge variant={servingVariant}>{servingLabel}</Badge>
                          </td>
                          <td className="px-3 py-3 text-right align-top">
                            <div className="flex flex-col items-end gap-2">
                              {deployment.servingStatus === "serving" && deployment.domain ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`https://${deployment.domain}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={servingActionView}
                                  >
                                    {servingActionView}
                                  </Link>
                                </Button>
                              ) : deployment.servingStatus === "ready" ? (
                                <div className="flex flex-col items-end gap-2">
                                  <ActionForm
                                    action={translateAndServeAction}
                                    loading="Starting translation..."
                                    success="Translation started."
                                    error="Unable to start translation."
                                    refreshOnSuccess={false}
                                  >
                                    <>
                                      <input name="siteId" type="hidden" value={site.id} />
                                      <input name="siteStatus" type="hidden" value={site.status} />
                                      <input
                                        name="targetLang"
                                        type="hidden"
                                        value={deployment.targetLang}
                                      />
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                          !canStartServing || Boolean(deployment.translationRun)
                                        }
                                        title={
                                          deployment.translationRun
                                            ? "Translation already running."
                                            : canStartServing
                                              ? servingActionTranslate
                                              : "Daily site crawl limit reached."
                                        }
                                      >
                                        {servingActionTranslate}
                                      </Button>
                                    </>
                                  </ActionForm>
                                  {deployment.translationRun ? (
                                    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                                      <span>
                                        Translation{" "}
                                        {deployment.translationRun.status === "queued"
                                          ? "queued"
                                          : "in progress"}
                                        {deployment.translationRun.pagesTotal
                                          ? ` (${deployment.translationRun.pagesCompleted}/${deployment.translationRun.pagesTotal})`
                                          : ""}
                                      </span>
                                      <ActionForm
                                        action={cancelTranslationRunAction}
                                        loading="Cancelling run..."
                                        success="Translation run cancelled."
                                        error="Unable to cancel run."
                                      >
                                        <>
                                          <input name="siteId" type="hidden" value={site.id} />
                                          <input
                                            name="runId"
                                            type="hidden"
                                            value={deployment.translationRun.id}
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            type="submit"
                                            disabled={!canManageTranslations}
                                            title="Cancel"
                                          >
                                            Cancel
                                          </Button>
                                        </>
                                      </ActionForm>
                                    </div>
                                  ) : null}
                                </div>
                              ) : deployment.servingStatus === "needs_domain" ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    href={`/dashboard/sites/${site.id}#domains`}
                                    title={servingActionVerify}
                                  >
                                    {servingActionVerify}
                                  </Link>
                                </Button>
                              ) : deployment.servingStatus === "disabled" ? null : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  title={servingActionEnable}
                                >
                                  {servingActionEnable}
                                </Button>
                              )}
                              {showToggle ? (
                                <ActionForm
                                  action={setLocaleServingAction}
                                  loading="Updating serving..."
                                  success="Serving updated."
                                  error="Unable to update serving."
                                >
                                  <>
                                    <input name="siteId" type="hidden" value={site.id} />
                                    <input
                                      name="targetLang"
                                      type="hidden"
                                      value={deployment.targetLang}
                                    />
                                    <input name="enabled" type="hidden" value={toggleValue} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!canToggleServing}
                                      title={toggleLabel}
                                    >
                                      {toggleLabel}
                                    </Button>
                                  </>
                                </ActionForm>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{deploymentsTitle}</CardTitle>
          <CardDescription>{deploymentsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{deploymentsEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{deploymentLanguageLabel}</th>
                    <th className="px-3 py-2 text-left">
                      <InfoHeader
                        label={deploymentStatusLabel}
                        helpLabel={deploymentStatusHelpLabel}
                        helpText={deploymentStatusHelp}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <InfoHeader
                        label={deploymentIdLabel}
                        helpLabel={deploymentIdHelpLabel}
                        helpText={deploymentIdHelp}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <InfoHeader
                        label={activeDeploymentLabel}
                        helpLabel={activeDeploymentHelpLabel}
                        helpText={activeDeploymentHelp}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <InfoHeader
                        label={deploymentRouteLabel}
                        helpLabel={deploymentRouteHelpLabel}
                        helpText={deploymentRouteHelp}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((deployment) => (
                    <tr key={`${deployment.targetLang}-${deployment.deploymentId ?? "none"}`}>
                      <td className="px-3 py-3 align-top font-semibold text-foreground">
                        {deployment.targetLang.toUpperCase()}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant="outline">{deployment.status}</Badge>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {renderOptionalValue(deployment.deploymentId, true)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {renderOptionalValue(deployment.activeDeploymentId, true)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {renderOptionalValue(deployment.routePrefix, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Force full website crawl</CardTitle>
          <CardDescription>
            Run a full crawl to capture source changes and refresh translations immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <p>
                Allowed per day:{" "}
                <span className="font-semibold text-foreground">{siteCrawlLimitLabel}</span>
              </p>
              <p>
                Remaining today:{" "}
                <span className="font-semibold text-foreground">{siteCrawlRemainingLabel}</span>
              </p>
            </div>
            {canCrawl ? (
              <ActionForm
                action={triggerCrawlAction}
                loading="Starting crawl..."
                success="Crawl enqueued."
                error="Unable to enqueue crawl."
                refreshOnSuccess={false}
              >
                <>
                  <input name="siteId" type="hidden" value={site.id} />
                  <input name="force" type="hidden" value="true" />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!crawlReady || siteCrawlLimitReached}
                    title={
                      !crawlReady
                        ? "Enable localization to crawl."
                        : siteCrawlLimitReached
                          ? "Daily site crawl limit reached."
                          : "Enqueue a full-site crawl."
                    }
                  >
                    Force full website crawl
                  </Button>
                </>
              </ActionForm>
            ) : (
              <Button variant="outline" disabled>
                Force full website crawl
              </Button>
            )}
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {siteCrawlLimitReached
              ? "Daily crawl limit reached. Try again tomorrow or upgrade your plan."
              : !crawlReady
                ? "Enable localization before forcing a crawl."
                : "Use this after publishing changes on your source site to refresh translations."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function pickPreferredLocale(acceptLanguageHeader: string): string {
  const first = acceptLanguageHeader.split(",")[0]?.split(";")[0]?.trim();
  return first && first.length ? first : "en";
}

function formatPlanLabel(planType: string | null): string | null {
  if (!planType) {
    return null;
  }
  return planType.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildSlotSummary(
  activeSiteCount: number | null,
  maxSites: number | null,
  planLabel: string | null,
): string | null {
  if (activeSiteCount === null && maxSites === null) {
    return null;
  }
  const planName = planLabel ? `${planLabel} plan` : "plan";
  if (maxSites === null) {
    if (activeSiteCount === null) {
      return `Your ${planName} includes unlimited active sites.`;
    }
    const siteLabel = activeSiteCount === 1 ? "site" : "sites";
    return `Your ${planName} includes unlimited active sites. ${activeSiteCount} ${siteLabel} currently active.`;
  }
  const slotLabel = maxSites === 1 ? "site slot" : "site slots";
  if (activeSiteCount === null) {
    return `Your ${planName} includes ${maxSites} active ${slotLabel}.`;
  }
  return `You are using ${activeSiteCount} of ${maxSites} active ${slotLabel}.`;
}

function InfoHeader({
  label,
  helpLabel,
  helpText,
}: {
  label: string;
  helpLabel: string;
  helpText: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label={helpLabel}
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-xs text-xs text-muted-foreground">
          {helpText}
        </PopoverContent>
      </Popover>
    </span>
  );
}

function renderOptionalValue(value: string | null | undefined, mono: boolean) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  const className = mono ? "font-mono text-foreground" : "text-foreground";
  return <span className={className}>{value}</span>;
}

function resolveServingStatusVariant(status: Deployment["servingStatus"]) {
  switch (status) {
    case "serving":
      return "default";
    case "ready":
      return "secondary";
    case "disabled":
      return "outline";
    case "needs_domain":
      return "outline";
    case "inactive":
    default:
      return "outline";
  }
}

function resolveDomainStatusVariant(status: Deployment["domainStatus"] | null) {
  switch (status) {
    case "verified":
      return "secondary";
    case "failed":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
}
