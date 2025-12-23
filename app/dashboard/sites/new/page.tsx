import { OnboardingForm } from "./onboarding-form";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSupportedLanguages } from "@internal/dashboard/webhooks";
import { headers } from "next/headers";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { i18nConfig } from "@internal/i18n";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

export default async function NewSitePage() {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked;
  const canGlossary = auth.has({ allFeatures: ["edit", "glossary"] }) && !billingBlocked;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  if (!canCreateSite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {billingBlocked ? "Billing action required" : "Site creation is locked"}
          </CardTitle>
          <CardDescription>
            {billingBlocked
              ? "Update billing to resume onboarding new sites."
              : "Upgrade your plan to onboard new sites and start translating."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={pricingPath}>{billingBlocked ? "Update billing" : "Upgrade plan"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/sites">Back to sites</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const maxLocales = auth.account!.featureFlags.maxLocales;
  const supportedLanguages = await listSupportedLanguages();
  const displayLocale = pickPreferredLocale((await headers()).get("accept-language") ?? "");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Add a new site</h2>
        <p className="text-sm text-muted-foreground">
          Guided setup to capture your source URL, language settings, and domain pattern.
        </p>
      </div>
      <OnboardingForm
        maxLocales={maxLocales}
        supportedLanguages={supportedLanguages}
        displayLocale={displayLocale}
        canGlossary={canGlossary}
        pricingPath={pricingPath}
      />
    </div>
  );
}

function pickPreferredLocale(acceptLanguageHeader: string): string {
  const first = acceptLanguageHeader.split(",")[0]?.split(";")[0]?.trim();
  return first && first.length ? first : "en";
}
