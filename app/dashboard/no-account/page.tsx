import Link from "next/link";
import { notFound } from "next/navigation";

import { PricingTableEmbed } from "./pricing-table";

import { claimAccount } from "@/app/dashboard/no-account/actions";
import { logout } from "@/app/auth/logout/actions";
import { ActionForm } from "@/components/dashboard/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { envServer } from "@internal/core/env-server";
import { getPricingTableId } from "@internal/billing";
import { i18nConfig } from "@internal/i18n";
import { buildNoAccountOnboardingState } from "@internal/dashboard/onboarding-state";

export default async function NoAccountPage() {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const locale = i18nConfig.defaultLocale;
  const pricingTableId = getPricingTableId(locale);
  const publishableKey = envServer.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const onboardingState = buildNoAccountOnboardingState();

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <Card className="border-border/80 bg-background">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>No dashboard account linked yet</CardTitle>
            <CardDescription>
              You are signed in, but this workspace has not been claimed yet. Create free dashboard
              access first, then choose a plan when you are ready to upgrade.
            </CardDescription>
          </div>
          <Badge variant="outline">{onboardingState.badge}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{onboardingState.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{onboardingState.description}</p>
          </div>
          <ol className="grid gap-2 rounded-lg border border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground sm:grid-cols-3">
            <li>
              <span className="font-semibold text-foreground">1.</span> Claim dashboard access
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span> Continue into onboarding
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span> Update billing when needed
            </li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <ActionForm
              action={claimAccount}
              loading="Creating dashboard access..."
              success="Dashboard access linked. Redirecting to dashboard."
              error="Unable to create your account."
              refreshOnSuccess={false}
            >
              <Button type="submit">Create free dashboard access</Button>
            </ActionForm>
            <Button asChild>
              <Link href={`/${locale}/pricing`}>View pricing page</Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
            <Button asChild variant="ghost">
              <a href="mailto:contact@weblingo.app">Contact support</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PricingTableEmbed pricingTableId={pricingTableId} publishableKey={publishableKey} />
    </div>
  );
}
