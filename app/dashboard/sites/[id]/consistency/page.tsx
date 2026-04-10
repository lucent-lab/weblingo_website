import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { ConsistencyManager } from "./consistency-manager";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchConsistencyBlocks,
  fetchConsistencyCpm,
  fetchConsistencyOverrideHygiene,
  fetchSite,
  type ConsistencyBlock,
  type ConsistencyCpmEntry,
  type ConsistencyOverrideHygieneWarning,
  type Site,
  WebhooksApiError,
} from "@internal/dashboard/webhooks";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { resolvePreferredLocale, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Consistency governance",
  robots: { index: false, follow: false },
};

type SiteConsistencyPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ targetLang?: string }>;
};

export default async function SiteConsistencyPage({
  params,
  searchParams,
}: SiteConsistencyPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth;
  if (!authToken) {
    throw new Error("Dashboard auth context is missing webhooksAuth.");
  }
  const mutationsAllowed = auth.mutationsAllowed;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
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
  let siteLoadError: unknown = null;

  try {
    site = await fetchSite(authToken, id);
  } catch (error) {
    siteLoadError = error;
    if (error instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSite consistency failed", {
        siteId: id,
        status: error.status,
        message: error.message,
        details: error.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSite consistency failed (unknown error)", {
        siteId: id,
        message: siteLoadError,
      });
    }
  }

  if (!site) {
    if (siteLoadError) {
      const errorView = resolveDashboardErrorView(siteLoadError, {
        title: "Unable to load site",
        description:
          "We could not complete your request. You can retry or return to the site list.",
        message: "Unable to load site.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard/sites">Back to sites</Link>
            </Button>
          }
        />
      );
    }
    notFound();
  }

  const localePairs = Array.from(
    new Map(site.locales.map((locale) => [locale.targetLang, locale.sourceLang])).entries(),
  ).map(([targetLang, sourceLang]) => ({ targetLang, sourceLang }));
  const availableTargetLangs = localePairs.map((pair) => pair.targetLang);
  const requestedTargetLang = resolvedSearchParams?.targetLang;
  const selectedTargetLang =
    requestedTargetLang && availableTargetLangs.includes(requestedTargetLang)
      ? requestedTargetLang
      : (availableTargetLangs[0] ?? null);

  if (!selectedTargetLang) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No target locales configured</CardTitle>
          <CardDescription>
            Add at least one target locale before using consistency governance.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedSourceLang =
    localePairs.find((pair) => pair.targetLang === selectedTargetLang)?.sourceLang ??
    site.locales[0]?.sourceLang ??
    "en";

  let cpmEntries: ConsistencyCpmEntry[] = [];
  let blocks: ConsistencyBlock[] = [];
  let overrideWarnings: ConsistencyOverrideHygieneWarning[] = [];
  let dataLoadError: unknown = null;

  const [cpmResult, blocksResult, warningsResult] = await Promise.allSettled([
    fetchConsistencyCpm(authToken, site.id, {
      targetLang: selectedTargetLang,
      sourceLang: selectedSourceLang,
      limit: 100,
      offset: 0,
    }),
    fetchConsistencyBlocks(authToken, site.id),
    fetchConsistencyOverrideHygiene(authToken, site.id, {
      targetLang: selectedTargetLang,
      sourceLang: selectedSourceLang,
      limit: 100,
      offset: 0,
    }),
  ]);

  if (cpmResult.status === "fulfilled") {
    cpmEntries = cpmResult.value.entries;
  } else {
    dataLoadError = cpmResult.reason;
  }

  if (blocksResult.status === "fulfilled") {
    blocks = blocksResult.value.blocks;
  } else {
    dataLoadError = dataLoadError ?? blocksResult.reason;
  }

  if (warningsResult.status === "fulfilled") {
    overrideWarnings = warningsResult.value.warnings;
  } else {
    dataLoadError = dataLoadError ?? warningsResult.reason;
  }

  const pricingPath = `/${locale}/pricing`;

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

      <Card>
        <CardHeader>
          <CardTitle>Locale scope</CardTitle>
          <CardDescription>
            Switch locale to review canonicals, blocks, and override conflicts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {availableTargetLangs.map((targetLang) => {
            const active = targetLang === selectedTargetLang;
            const href =
              targetLang === availableTargetLangs[0]
                ? `/dashboard/sites/${site.id}/consistency`
                : `/dashboard/sites/${site.id}/consistency?targetLang=${encodeURIComponent(targetLang)}`;
            return (
              <Link key={targetLang} href={href}>
                <Badge variant={active ? "default" : "secondary"}>{targetLang}</Badge>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {!canEdit ? (
        <LockedFeatureCard
          title="Consistency governance"
          description={
            mutationsAllowed
              ? "Upgrade to edit canonical phrases and block policies."
              : "Update billing to resume consistency governance edits."
          }
          pricingPath={pricingPath}
          ctaLabel={mutationsAllowed ? "Upgrade plan" : "Update billing"}
          badgeLabel={mutationsAllowed ? "Locked" : "Billing issue"}
        />
      ) : dataLoadError ? (
        (() => {
          const errorView = resolveDashboardErrorView(dataLoadError, {
            title: "Unable to load consistency data",
            description:
              "We could not complete your request. You can retry or return to the site list.",
            message: "Unable to load consistency data.",
          });

          return (
            <ErrorStateCard
              title={errorView.title}
              description={errorView.description}
              message={errorView.message}
              actions={
                <Button asChild variant="outline">
                  <Link href="/dashboard/sites">Back to sites</Link>
                </Button>
              }
            />
          );
        })()
      ) : (
        <ConsistencyManager
          siteId={site.id}
          sourceLang={selectedSourceLang}
          targetLang={selectedTargetLang}
          canMutate={canEdit}
          cpmEntries={cpmEntries}
          blocks={blocks}
          overrideWarnings={overrideWarnings}
        />
      )}
    </div>
  );
}
