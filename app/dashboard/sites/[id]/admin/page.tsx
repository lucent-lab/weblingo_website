import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { SiteAdminForm } from "./site-admin-form";

import { activateSiteAction, deactivateSiteAction } from "../../../actions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchSite,
  listSites,
  listSupportedLanguages,
  type Site,
} from "@internal/dashboard/webhooks";
import { i18nConfig } from "@internal/i18n";

export const metadata = {
  title: "Site settings",
  robots: { index: false, follow: false },
};

type SiteAdminPageProps = {
  params: { id: string };
  searchParams?: {
    toast?: string | string[];
    error?: string | string[];
  };
};

export default async function SiteAdminPage({ params, searchParams }: SiteAdminPageProps) {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const canEdit = auth.has({ allFeatures: ["edit", "locale_update"] }) && !billingBlocked;
  const canDeactivate = auth.has({ feature: "edit" }) && !billingBlocked;
  const canActivate = auth.has({ allFeatures: ["edit", "locale_update"] }) && !billingBlocked;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const toastMessage = decodeSearchParam(searchParams?.toast);
  const actionErrorMessage = decodeSearchParam(searchParams?.error);
  let site: Site | null = null;
  let activeSiteCount: number | null = null;
  let error: string | null = null;

  try {
    site = await fetchSite(auth.webhooksAuth!, params.id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site settings.";
  }

  if (site && canActivate) {
    try {
      const sites = await listSites(auth.webhooksAuth!);
      activeSiteCount = sites.filter((entry) => entry.status === "active").length;
    } catch (err) {
      console.warn("[dashboard] listSites failed while checking slots:", err);
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

  const supportedLanguages = canEdit ? await listSupportedLanguages() : [];
  const displayLocale = pickPreferredLocale((await headers()).get("accept-language") ?? "");
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const localeAliases = site.locales.reduce<Record<string, string | null>>((acc, locale) => {
    acc[locale.targetLang] = locale.alias ?? null;
    return acc;
  }, {});
  const hasVerifiedDomain = site.domains.some((domain) => domain.status === "verified");
  const siteProfile = site.siteProfile ?? {};
  const brandVoice =
    typeof siteProfile.brandVoice === "string" ? siteProfile.brandVoice : undefined;
  const siteProfileNotes =
    typeof siteProfile.description === "string" ? siteProfile.description : undefined;
  const maxSites = auth.account?.featureFlags.maxSites ?? null;
  const slotCheckUnavailable = maxSites !== null && activeSiteCount === null;
  const hasAvailableSlot =
    maxSites === null || activeSiteCount === null || activeSiteCount < maxSites;
  const activationDisabled = !hasAvailableSlot || !hasVerifiedDomain || !canActivate;

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
          supportedLanguages={supportedLanguages}
          displayLocale={displayLocale}
          initialBrandVoice={brandVoice}
          initialSiteProfileNotes={siteProfileNotes}
        />
      )}

      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Site status</CardTitle>
          <CardDescription>
            Deactivating stops crawls and serving for this site. Data stays intact and you can
            reactivate later after verifying a domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Current status:{" "}
              <span className="font-semibold text-foreground">{site.status}</span>
            </p>
            {site.status === "active" ? (
              canDeactivate ? (
                <form action={deactivateSiteAction}>
                  <input name="siteId" type="hidden" value={site.id} />
                  <Button type="submit" variant="destructive">
                    Deactivate site
                  </Button>
                </form>
              ) : (
                <Button variant="outline" disabled>
                  Deactivate site
                </Button>
              )
            ) : canActivate ? (
              <form action={activateSiteAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <Button type="submit" variant="outline" disabled={activationDisabled}>
                  Activate site
                </Button>
              </form>
            ) : (
              <Button variant="outline" disabled>
                Activate site
              </Button>
            )}
          </div>
          {site.status === "inactive" && !hasAvailableSlot ? (
            <p className="text-xs text-destructive">
              No active site slots available. Deactivate another site or upgrade your plan to add
              more.
            </p>
          ) : null}
          {site.status === "inactive" && slotCheckUnavailable ? (
            <p className="text-xs text-muted-foreground">
              We could not verify slot availability right now. Activation will be validated when
              you submit.
            </p>
          ) : null}
          {site.status === "inactive" && !hasVerifiedDomain ? (
            <p className="text-xs text-muted-foreground">
              Verify at least one domain before activating this site.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Deactivated sites do not count toward your active site limit.
          </p>
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
