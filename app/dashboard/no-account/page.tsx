import Link from "next/link";
import { notFound } from "next/navigation";

import { PricingTableEmbed } from "./pricing-table";

import { claimAccount } from "@/app/dashboard/no-account/actions";
import { logout } from "@/app/auth/logout/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { env } from "@internal/core";
import { getPricingTableId } from "@internal/billing";
import { i18nConfig } from "@internal/i18n";

type NoAccountPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NoAccountPage({ searchParams }: NoAccountPageProps) {
  if (env.PUBLIC_PORTAL_MODE !== "enabled") {
    notFound();
  }
  const locale = i18nConfig.defaultLocale;
  const pricingTableId = getPricingTableId(locale);
  const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const resolvedSearchParams = await searchParams;
  const rawError = resolvedSearchParams?.error;
  const errorMessages: Record<string, string> = {
    claim_failed: "We could not create your account yet. Please try again.",
    session_expired: "Your session expired. Please sign in again.",
  };
  let error: string | null = null;
  if (typeof rawError === "string") {
    let decoded = rawError;
    try {
      decoded = decodeURIComponent(rawError);
    } catch {
      decoded = rawError;
    }
    error = errorMessages[decoded] ?? "An unexpected error occurred.";
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <Card className="border-border/80 bg-background">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>No account found</CardTitle>
            <CardDescription>
              You are signed in, but no dashboard account is linked yet. Pick a plan to get started
              or sign out and switch accounts.
            </CardDescription>
          </div>
          <Badge variant="outline">Status: pending access</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <form action={claimAccount}>
              <Button type="submit">Create your account</Button>
            </form>
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
