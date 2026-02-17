import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsistencyManager } from "./consistency-manager";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";

import { Badge } from "@/components/ui/badge";
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
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

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
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");

  let site: Site | null = null;
  let siteLoadError: string | null = null;

  try {
    site = await fetchSite(authToken, id);
  } catch (error) {
    siteLoadError = error instanceof Error ? error.message : "Unable to load site.";
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
      return (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load site</CardTitle>
            <CardDescription>{siteLoadError}</CardDescription>
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
  let dataLoadError: string | null = null;

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
    dataLoadError =
      cpmResult.reason instanceof Error
        ? cpmResult.reason.message
        : "Unable to load canonical phrases.";
  }

  if (blocksResult.status === "fulfilled") {
    blocks = blocksResult.value.blocks;
  } else {
    dataLoadError =
      dataLoadError ??
      (blocksResult.reason instanceof Error
        ? blocksResult.reason.message
        : "Unable to load consistency blocks.");
  }

  if (warningsResult.status === "fulfilled") {
    overrideWarnings = warningsResult.value.warnings;
  } else {
    dataLoadError =
      dataLoadError ??
      (warningsResult.reason instanceof Error
        ? warningsResult.reason.message
        : "Unable to load override hygiene warnings.");
  }

  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;

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
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load consistency data</CardTitle>
            <CardDescription>{dataLoadError}</CardDescription>
          </CardHeader>
        </Card>
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
