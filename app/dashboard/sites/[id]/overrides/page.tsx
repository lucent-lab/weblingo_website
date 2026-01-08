import Link from "next/link";
import { notFound } from "next/navigation";

import { GlossaryEditor } from "../glossary-editor";
import { LockedFeatureCard } from "../locked-feature-card";
import { SiteHeader } from "../site-header";
import { OverrideForm, SlugForm } from "../translation-forms";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchGlossary,
  fetchSite,
  WebhooksApiError,
  type GlossaryEntry,
  type Site,
} from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Overrides",
  robots: { index: false, follow: false },
};

type SiteOverridesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SiteOverridesPage({ params }: SiteOverridesPageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
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
  let error: string | null = null;

  const [siteResult, glossaryResult] = await Promise.allSettled([
    fetchSite(authToken, id),
    canGlossary ? fetchGlossary(authToken, id) : Promise.resolve([] as GlossaryEntry[]),
  ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    const err = siteResult.reason;
    error = err instanceof Error ? err.message : "Unable to load overrides.";
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
    if (err instanceof WebhooksApiError) {
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
      const message = err instanceof Error ? err.message : "Unable to load overrides.";
      console.warn("[dashboard] fetchGlossary failed (unknown error)", {
        siteId: id,
        message,
      });
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

  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));

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

      {canGlossary ? (
        <Card>
          <CardHeader>
            <CardTitle>Glossary</CardTitle>
            <CardDescription>
              Maintain terminology control and optional retranslate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GlossaryEditor initialEntries={glossary} siteId={site.id} targetLangs={targetLangs} />
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

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>
    </div>
  );
}
