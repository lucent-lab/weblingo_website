import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Info } from "lucide-react";

import { SiteAdminForm } from "./site-admin-form";

import {
  activateSiteAction,
  cancelTranslationRunAction,
  deactivateSiteAction,
  deleteSiteAction,
  setLocaleServingAction,
  translateAndServeAction,
  triggerCrawlAction,
} from "../../../actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached, listSupportedLanguagesCached } from "@internal/dashboard/data";
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
  searchParams?: Promise<{
    toast?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SiteAdminPage({ params, searchParams }: SiteAdminPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const canEdit = auth.has({ allFeatures: ["edit", "locale_update"] }) && !billingBlocked;
  const canDeactivate = auth.has({ feature: "edit" }) && !billingBlocked;
  const canDelete = auth.has({ feature: "edit" });
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && !billingBlocked;
  const canActivate = auth.has({ feature: "edit" }) && !billingBlocked;
  const canToggleServing = canEdit;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const returnTo = `/dashboard/sites/${id}/admin`;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const toastMessage = decodeSearchParam(resolvedSearchParams?.toast);
  const actionErrorMessage = decodeSearchParam(resolvedSearchParams?.error);
  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let activeSiteCount: number | null = null;
  let error: string | null = null;
  let supportedLanguages: SupportedLanguage[] = [];

  try {
    site = await fetchSite(auth.webhooksAuth!, id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site settings.";
  }

  if (site) {
    const [deploymentsResult, sitesResult, supportedLanguagesResult] = await Promise.allSettled([
      fetchDeployments(auth.webhooksAuth!, id),
      listSitesCached(auth.webhooksAuth!),
      canEdit ? listSupportedLanguagesCached() : Promise.resolve([]),
    ]);

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
  const deploymentsByLang = new Map(
    deployments.map((deployment) => [deployment.targetLang, deployment]),
  );
  const servingRows = targetLangs
    .map((lang) => deploymentsByLang.get(lang))
    .filter((deployment): deployment is Deployment => Boolean(deployment));

  return (
    <div className="space-y-6">
      {actionErrorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionErrorMessage}{" "}
          <Link className="font-medium underline" href={`/dashboard/sites/${site.id}/admin`}>
            Dismiss
          </Link>
        </div>
      ) : toastMessage ? (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {toastMessage}{" "}
          <Link className="font-medium underline" href={`/dashboard/sites/${site.id}/admin`}>
            Dismiss
          </Link>
        </div>
      ) : null}
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

      {!canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {billingBlocked ? "Billing action required" : "Site settings locked"}
            </CardTitle>
            <CardDescription>
              {billingBlocked
                ? "Update billing to resume editing this site."
                : "Upgrade your plan to edit site languages and routing."}
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
      ) : (
        <SiteAdminForm
          siteId={site.id}
          sourceUrl={site.sourceUrl}
          sourceLang={site.locales[0]?.sourceLang ?? ""}
          targets={targetLangs}
          aliases={localeAliases}
          pattern={site.routeConfig?.pattern ?? null}
          maxLocales={site.maxLocales ?? null}
          servingMode={site.servingMode}
          supportedLanguages={supportedLanguages}
          displayLocale={displayLocale}
          initialBrandVoice={brandVoice}
          initialSiteProfileNotes={siteProfileNotes}
        />
      )}

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
                <form action={deactivateSiteAction}>
                  <input name="siteId" type="hidden" value={site.id} />
                  <Button type="submit" variant="destructive">
                    Pause localization
                  </Button>
                </form>
              ) : (
                <Button variant="outline" disabled>
                  Pause localization
                </Button>
              )
            ) : canActivate ? (
              <form action={activateSiteAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <Button type="submit" variant="outline" disabled={activationDisabled}>
                  Enable localization
                </Button>
              </form>
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
                <Link href={`https://${firstServingDomain}`} target="_blank" rel="noreferrer">
                  View live site
                </Link>
              </Button>
            ) : site.status !== "active" ? (
              <Button variant="outline" disabled>
                Enable localization first
              </Button>
            ) : !hasVerifiedDomain ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/sites/${site.id}#domains`}>Verify a domain</Link>
              </Button>
            ) : canCrawl ? (
              <form action={triggerCrawlAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={siteCrawlLimitReached}
                  title={siteCrawlLimitReached ? "Daily site crawl limit reached." : undefined}
                >
                  Start serving
                </Button>
              </form>
            ) : (
              <Button variant="outline" disabled>
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
                                  >
                                    {servingActionView}
                                  </Link>
                                </Button>
                              ) : deployment.servingStatus === "ready" ? (
                                <div className="flex flex-col items-end gap-2">
                                  <form action={translateAndServeAction}>
                                    <input name="siteId" type="hidden" value={site.id} />
                                    <input name="siteStatus" type="hidden" value={site.status} />
                                    <input
                                      name="targetLang"
                                      type="hidden"
                                      value={deployment.targetLang}
                                    />
                                    <input name="returnTo" type="hidden" value={returnTo} />
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
                                            ? undefined
                                            : "Daily site crawl limit reached."
                                      }
                                    >
                                      {servingActionTranslate}
                                    </Button>
                                  </form>
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
                                      <form action={cancelTranslationRunAction}>
                                        <input name="siteId" type="hidden" value={site.id} />
                                        <input
                                          name="runId"
                                          type="hidden"
                                          value={deployment.translationRun.id}
                                        />
                                        <input name="returnTo" type="hidden" value={returnTo} />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          type="submit"
                                          disabled={!canManageTranslations}
                                        >
                                          Cancel
                                        </Button>
                                      </form>
                                    </div>
                                  ) : null}
                                </div>
                              ) : deployment.servingStatus === "needs_domain" ? (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/dashboard/sites/${site.id}#domains`}>
                                    {servingActionVerify}
                                  </Link>
                                </Button>
                              ) : deployment.servingStatus === "disabled" ? null : (
                                <Button size="sm" variant="outline" disabled>
                                  {servingActionEnable}
                                </Button>
                              )}
                              {showToggle ? (
                                <form action={setLocaleServingAction}>
                                  <input name="siteId" type="hidden" value={site.id} />
                                  <input
                                    name="targetLang"
                                    type="hidden"
                                    value={deployment.targetLang}
                                  />
                                  <input name="enabled" type="hidden" value={toggleValue} />
                                  <input name="returnTo" type="hidden" value={returnTo} />
                                  <Button size="sm" variant="outline" disabled={!canToggleServing}>
                                    {toggleLabel}
                                  </Button>
                                </form>
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
              <form action={triggerCrawlAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
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
              </form>
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

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deleting a site removes its pages, translations, deployments, and domains. This cannot
            be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This action permanently deletes all data for this site.
          </div>
          <form action={deleteSiteAction} className="space-y-3">
            <input name="siteId" type="hidden" value={site.id} />
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type DELETE to confirm
              </label>
              <Input
                name="confirmation"
                placeholder="DELETE"
                required
                pattern="DELETE"
                autoComplete="off"
                disabled={!canDelete}
              />
            </div>
            <Button type="submit" variant="destructive" disabled={!canDelete}>
              Delete site
            </Button>
            {!canDelete ? (
              <p className="text-xs text-muted-foreground">
                You do not have permission to delete this site.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function decodeSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
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
