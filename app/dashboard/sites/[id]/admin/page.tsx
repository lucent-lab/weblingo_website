import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";

import { SiteAdminForm } from "./site-admin-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { fetchSite, listSupportedLanguages, type Site } from "@internal/dashboard/webhooks";
import { i18nConfig } from "@internal/i18n";

export const metadata = {
  title: "Site settings",
  robots: { index: false, follow: false },
};

type SiteAdminPageProps = {
  params: { id: string };
};

export default async function SiteAdminPage({ params }: SiteAdminPageProps) {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const canEdit = auth.has({ allFeatures: ["edit", "locale_update"] }) && !billingBlocked;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  let site: Site | null = null;
  let error: string | null = null;

  try {
    site = await fetchSite(auth.webhooksAuth!, params.id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site settings.";
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

  if (!canEdit) {
    return (
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
    );
  }

  const supportedLanguages = await listSupportedLanguages();
  const displayLocale = pickPreferredLocale((await headers()).get("accept-language") ?? "");
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const localeAliases = site.locales.reduce<Record<string, string | null>>((acc, locale) => {
    acc[locale.targetLang] = locale.alias ?? null;
    return acc;
  }, {});
  const siteProfile = site.siteProfile ?? {};
  const brandVoice =
    typeof siteProfile.brandVoice === "string" ? siteProfile.brandVoice : undefined;
  const siteProfileNotes =
    typeof siteProfile.description === "string" ? siteProfile.description : undefined;

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
    </div>
  );
}

function pickPreferredLocale(acceptLanguageHeader: string): string {
  const first = acceptLanguageHeader.split(",")[0]?.split(";")[0]?.trim();
  return first && first.length ? first : "en";
}
