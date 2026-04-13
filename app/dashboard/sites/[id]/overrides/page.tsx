import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { GlossaryEditor } from "../glossary-editor";
import { LockedFeatureCard } from "../locked-feature-card";
import { PageSectionNav } from "../page-section-nav";
import { SiteHeader } from "../site-header";
import { OverrideForm, SlugForm } from "../translation-forms";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchGlossary,
  fetchSite,
  type GlossaryEntry,
  type Site,
  WebhooksApiError,
} from "@internal/dashboard/webhooks";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { resolvePreferredLocale, resolveLocaleTranslator } from "@internal/i18n";
import {
  buildConsistencyLocaleScopes,
  formatConsistencyLocaleScopeLabel,
  selectConsistencyLocaleScope,
} from "../consistency/locale-scope";
import {
  fetchConsistencyBlocks,
  fetchConsistencyCpm,
  fetchConsistencyOverrideHygiene,
  type ConsistencyBlock,
  type ConsistencyCpmEntry,
  type ConsistencyOverrideHygieneWarning,
} from "@internal/dashboard/webhooks";
import { ConsistencyManager } from "../consistency/consistency-manager";

export const metadata = {
  title: "Translation rules",
  robots: { index: false, follow: false },
};

type SiteOverridesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sourceLang?: string; targetLang?: string }>;
};

export default async function SiteOverridesPage({ params, searchParams }: SiteOverridesPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canGlossary = auth.has({ allFeatures: ["edit", "glossary"] }) && mutationsAllowed;
  const canOverrides = auth.has({ allFeatures: ["edit", "overrides"] }) && mutationsAllowed;
  const canSlugs = auth.has({ allFeatures: ["edit", "slug_edit"] }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");
  const lockCtaLabel = mutationsAllowed ? "Upgrade plan" : "Update billing";
  const lockBadgeLabel = mutationsAllowed ? "Locked" : "Billing issue";

  let site: Site | null = null;
  let glossary: GlossaryEntry[] = [];
  let error: unknown = null;

  const [siteResult, glossaryResult] = await Promise.allSettled([
    fetchSite(authToken, id),
    canGlossary ? fetchGlossary(authToken, id) : Promise.resolve([] as GlossaryEntry[]),
  ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    const err = siteResult.reason;
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

  if (glossaryResult.status === "fulfilled") {
    glossary = glossaryResult.value;
  } else {
    const err = glossaryResult.reason;
    if (err instanceof WebhooksApiError && err.status === 404) {
      glossary = [];
    } else if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchGlossary failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      const message = err instanceof Error ? err.message : "Unable to load translation rules.";
      console.warn("[dashboard] fetchGlossary failed (unknown error)", {
        siteId: id,
        message,
      });
    }
  }

  if (!site) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load site",
        description:
          "We could not complete your request. You can retry or return to the dashboard.",
        message: "Unable to load translation rules.",
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

  const targetLangs = Array.from(new Set(site.locales.map((entry) => entry.targetLang)));
  const localeScopes = buildConsistencyLocaleScopes(site.locales);
  const selectedLocaleScope = selectConsistencyLocaleScope(localeScopes, {
    sourceLang: resolvedSearchParams?.sourceLang,
    targetLang: resolvedSearchParams?.targetLang,
  });

  let cpmEntries: ConsistencyCpmEntry[] = [];
  let blocks: ConsistencyBlock[] = [];
  let overrideWarnings: ConsistencyOverrideHygieneWarning[] = [];
  let dataLoadError: unknown = null;

  if (selectedLocaleScope) {
    const [cpmResult, blocksResult, warningsResult] = await Promise.allSettled([
      fetchConsistencyCpm(authToken, site.id, {
        targetLang: selectedLocaleScope.targetLang,
        sourceLang: selectedLocaleScope.sourceLang,
        limit: 100,
        offset: 0,
      }),
      fetchConsistencyBlocks(authToken, site.id),
      fetchConsistencyOverrideHygiene(authToken, site.id, {
        targetLang: selectedLocaleScope.targetLang,
        sourceLang: selectedLocaleScope.sourceLang,
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

      <Card>
        <CardHeader>
          <CardTitle>Translation rules</CardTitle>
          <CardDescription>
            Manage glossary terms, manual overrides, localized slugs, and consistency policy from
            one surface.
          </CardDescription>
        </CardHeader>
      </Card>

      <PageSectionNav
        title="On this page"
        description="Jump directly to the rules surface you need."
        links={[
          { href: "#locale-scope", label: "Locale scope" },
          { href: "#glossary", label: "Glossary" },
          { href: "#manual-overrides", label: "Manual overrides" },
          { href: "#localized-slugs", label: "Localized slugs" },
          { href: "#consistency-governance", label: "Consistency governance" },
        ]}
      />

      <section id="locale-scope" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>Locale scope</CardTitle>
            <CardDescription>
              Switch locale pair to review canonicals, blocks, and override conflicts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {localeScopes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one target locale before using consistency governance.
              </p>
            ) : (
              localeScopes.map((scope) => {
                const active =
                  selectedLocaleScope !== null &&
                  scope.targetLang === selectedLocaleScope.targetLang &&
                  scope.sourceLang === selectedLocaleScope.sourceLang;
                const params = new URLSearchParams({
                  sourceLang: scope.sourceLang,
                  targetLang: scope.targetLang,
                });
                const href =
                  scope.sourceLang === localeScopes[0]?.sourceLang &&
                  scope.targetLang === localeScopes[0]?.targetLang
                    ? `/dashboard/sites/${site.id}/overrides`
                    : `/dashboard/sites/${site.id}/overrides?${params.toString()}`;
                return (
                  <Link key={`${scope.sourceLang}:${scope.targetLang}`} href={href}>
                    <Badge variant={active ? "default" : "secondary"}>
                      {formatConsistencyLocaleScopeLabel(scope)}
                    </Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section id="glossary" className="scroll-mt-24">
        {canGlossary ? (
          <Card>
            <CardHeader>
              <CardTitle>Glossary</CardTitle>
              <CardDescription>
                Maintain terminology control and optionally retranslate after glossary updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GlossaryEditor
                initialEntries={glossary}
                siteId={site.id}
                targetLangs={targetLangs}
              />
            </CardContent>
          </Card>
        ) : (
          <LockedFeatureCard
            title="Glossary"
            description={
              mutationsAllowed
                ? "Upgrade to manage glossary entries and keep terminology consistent."
                : "Update billing to resume glossary management."
            }
            pricingPath={pricingPath}
            ctaLabel={lockCtaLabel}
            badgeLabel={lockBadgeLabel}
          />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section id="manual-overrides" className="scroll-mt-24">
          {canOverrides ? (
            <OverrideForm siteId={site.id} />
          ) : (
            <LockedFeatureCard
              title="Manual overrides"
              description={
                mutationsAllowed
                  ? "Upgrade to override individual translations."
                  : "Update billing to resume manual overrides."
              }
              pricingPath={pricingPath}
              ctaLabel={lockCtaLabel}
              badgeLabel={lockBadgeLabel}
            />
          )}
        </section>
        <section id="localized-slugs" className="scroll-mt-24">
          {canSlugs ? (
            <SlugForm siteId={site.id} />
          ) : (
            <LockedFeatureCard
              title="Localized slugs"
              description={
                mutationsAllowed
                  ? "Upgrade to customize translated URL slugs."
                  : "Update billing to resume localized slug edits."
              }
              pricingPath={pricingPath}
              ctaLabel={lockCtaLabel}
              badgeLabel={lockBadgeLabel}
            />
          )}
        </section>
      </div>

      <section id="consistency-governance" className="scroll-mt-24">
        <Card>
          <CardHeader>
            <CardTitle>Consistency governance</CardTitle>
            <CardDescription>
              Review canonical phrases, blocks, and override conflicts for the selected locale pair.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedLocaleScope ? (
              <p className="text-sm text-muted-foreground">
                Add at least one target locale before using consistency governance.
              </p>
            ) : !canEdit ? (
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
                    "We could not complete your request. You can retry or return to the dashboard.",
                  message: "Unable to load consistency data.",
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
              })()
            ) : (
              <ConsistencyManager
                siteId={site.id}
                sourceLang={selectedLocaleScope.sourceLang}
                targetLang={selectedLocaleScope.targetLang}
                canMutate={canEdit}
                cpmEntries={cpmEntries}
                blocks={blocks}
                overrideWarnings={overrideWarnings}
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
