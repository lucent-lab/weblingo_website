import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { ManagedDemoCreateForm } from "./managed-demo-create-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import { listSupportedLanguagesCached } from "@internal/dashboard/data";
import { resolvePreferredLocale } from "@internal/i18n";
import { listManagedDemos, type ManagedDemoSiteSummary } from "@internal/dashboard/webhooks";
import { setWorkspaceAction } from "../../_lib/workspace-actions";

export const metadata = {
  title: "Managed demos",
  robots: { index: false, follow: false },
};

export default async function OpsShowcasesPage() {
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    notFound();
  }
  const actorAuth = auth.actorWebhooksAuth;
  if (!actorAuth) {
    notFound();
  }

  const [managedDemoResult, supportedLanguagesResult] = await Promise.allSettled([
    listManagedDemos(actorAuth),
    listSupportedLanguagesCached(),
  ]);
  const items = managedDemoResult.status === "fulfilled" ? managedDemoResult.value.items : [];
  const supportedLanguages =
    supportedLanguagesResult.status === "fulfilled" ? supportedLanguagesResult.value : [];
  const managedDemoError =
    managedDemoResult.status === "rejected"
      ? managedDemoResult.reason instanceof Error
        ? managedDemoResult.reason.message
        : "Unable to load managed demos right now."
      : null;
  const activeShowcases = items.filter((item) => item.showcase.status === "active").length;
  const servingShowcases = items.filter(
    (item) => item.showcaseServingStatus === "serving" || item.showcaseServingStatus === "degraded",
  ).length;
  const displayLocale = resolvePreferredLocale((await headers()).get("accept-language"));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">Managed demos</h2>
          <Badge variant="outline">Internal admin</Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Create and operate pre-sales showcase sites. This view always uses your admin account,
          even when you are currently acting inside a managed customer workspace.
        </p>
      </div>

      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle>Showcase pulse</CardTitle>
          <CardDescription>Quick view of the current managed-demo fleet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBlock label="Managed demos" value={`${items.length}`} />
          <InfoBlock label="Active showcase namespaces" value={`${activeShowcases}`} />
          <InfoBlock label="Currently serving" value={`${servingShowcases}`} />
        </CardContent>
      </Card>

      <ManagedDemoCreateForm
        supportedLanguages={supportedLanguages}
        displayLocale={displayLocale}
      />

      <Card>
        <CardHeader>
          <CardTitle>Demo inventory</CardTitle>
          <CardDescription>
            Track public showcase URLs, customer-domain readiness, and jump into the managed
            workspace for deeper site operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {managedDemoError ? (
            <div className="rounded-lg border border-dashed border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-100">
              Demo inventory is temporarily unavailable. You can still create a managed demo above.
              <div className="mt-2 text-xs opacity-80">{managedDemoError}</div>
            </div>
          ) : null}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              No managed demos yet. Create one above to provision the account, site, and showcase
              namespace in one step.
            </div>
          ) : (
            items.map((item) => <ManagedDemoRow key={item.siteId} item={item} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ManagedDemoRow({ item }: { item: ManagedDemoSiteSummary }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{item.sourceUrl}</p>
            <Badge variant={item.siteStatus === "active" ? "secondary" : "outline"}>
              Site {item.siteStatus}
            </Badge>
            <Badge variant={item.showcase.status === "active" ? "secondary" : "outline"}>
              Showcase {item.showcase.status}
            </Badge>
            <Badge variant="outline">Plan {item.accountPlan}</Badge>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
            <InfoRow label="Customer serving" value={item.customerServingStatus} />
            <InfoRow label="Showcase serving" value={item.showcaseServingStatus} />
            <InfoRow label="Workspace" value={item.accountId} />
            <InfoRow label="Site ID" value={item.siteId} />
            <InfoRow label="Website path" value={item.showcase.websitePath} />
            <InfoRow label="Default lang" value={item.showcase.defaultLang ?? "—"} />
          </div>
          {item.deployment ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Deployment focus:{" "}
              <span className="font-medium text-foreground">
                {item.deployment.targetLang.toUpperCase()}
              </span>
              {" · "}
              status{" "}
              <span className="font-medium text-foreground">{item.deployment.status ?? "—"}</span>
              {" · "}
              active pointer{" "}
              <span className="font-mono text-xs text-foreground">
                {item.deployment.activeDeploymentId ?? "—"}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 lg:min-w-64">
          <Button asChild variant="secondary">
            <Link
              href={item.showcase.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={!item.showcase.url ? "pointer-events-none opacity-60" : undefined}
            >
              Open showcase
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Locale URLs
            </p>
            <div className="mt-2 grid gap-2">
              {item.showcaseLocales.map((locale, index) => (
                <div
                  key={`${locale.targetLang}:${index}`}
                  className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                >
                  <Badge variant={locale.isDefault ? "secondary" : "outline"}>
                    {locale.targetLang.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{locale.showcaseServingStatus}</Badge>
                  <Link
                    href={locale.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {locale.url}
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <form action={setWorkspaceAction}>
            <input name="subjectAccountId" type="hidden" value={item.accountId} />
            <input
              name="redirectTo"
              type="hidden"
              value={`/dashboard/sites/${item.siteId}/settings`}
            />
            <Button type="submit" variant="outline" className="w-full">
              Open site settings
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
          <Button asChild variant="ghost" className="justify-start px-0">
            <Link href={`/dashboard/ops/accounts/${encodeURIComponent(item.accountId)}`}>
              Open account policy
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{label}:</span> {value}
    </div>
  );
}
