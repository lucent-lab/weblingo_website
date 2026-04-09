import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";
import { listAdminPreviews, type AdminPreviewSummary } from "@internal/dashboard/webhooks";

const PAGE_LIMIT = 20;

type OpsPreviewsPageProps = {
  searchParams?: Promise<{ offset?: string }>;
};

function normalizeOffset(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    return 0;
  }
  return Number.parseInt(value, 10);
}

function buildPreviewsHref(offset: number): string {
  if (offset <= 0) {
    return "/dashboard/ops/previews";
  }
  return `/dashboard/ops/previews?offset=${offset}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function statusBadgeVariant(status: AdminPreviewSummary["status"]): "secondary" | "outline" {
  return status === "ready" ? "secondary" : "outline";
}

export async function generateMetadata() {
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  return {
    title: t("dashboard.ops.previews.meta.title", "Preview reviews"),
    robots: { index: false, follow: false },
  };
}

export default async function OpsPreviewsPage({ searchParams }: OpsPreviewsPageProps) {
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    notFound();
  }
  const actorAuth = auth.actorWebhooksAuth;
  if (!actorAuth) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const offset = normalizeOffset(resolvedSearchParams?.offset);
  const response = await listAdminPreviews(actorAuth, { limit: PAGE_LIMIT, offset });
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );

  const previousHref = offset > 0 ? buildPreviewsHref(Math.max(offset - PAGE_LIMIT, 0)) : null;
  const nextHref = response.pagination.hasMore ? buildPreviewsHref(offset + PAGE_LIMIT) : null;
  const itemsWithReviews = response.items.filter((item) => item.feedback.reviewCount > 0).length;
  const readyCount = response.items.filter((item) => item.status === "ready").length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">
            {t("dashboard.ops.previews.heading", "Preview reviews")}
          </h2>
          <Badge variant="outline">
            {t("dashboard.ops.badge.internalAdmin", "Internal admin")}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t(
            "dashboard.ops.previews.intro",
            "Review recent preview runs, see whether structured feedback was submitted, and open a preview-centric detail page with the full review history.",
          )}
        </p>
      </div>

      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle>{t("dashboard.ops.previews.pulse.title", "Preview pulse")}</CardTitle>
          <CardDescription>
            {t(
              "dashboard.ops.previews.pulse.description",
              "Quick view of the previews currently visible in this inventory page.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBlock
            label={t("dashboard.ops.previews.summary.shown", "Shown")}
            value={`${response.items.length}`}
          />
          <InfoBlock
            label={t("dashboard.ops.previews.summary.withReviews", "With reviews")}
            value={`${itemsWithReviews}`}
          />
          <InfoBlock
            label={t("dashboard.ops.previews.summary.ready", "Ready previews")}
            value={`${readyCount}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.ops.previews.inventory.title", "Inventory")}</CardTitle>
          <CardDescription>
            {t(
              "dashboard.ops.previews.inventory.description",
              "Recent preview requests ordered by creation time, with direct access to the review detail surface.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {response.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              {t(
                "dashboard.ops.previews.inventory.empty",
                "No preview requests are available yet.",
              )}
            </div>
          ) : (
            response.items.map((item) => (
              <div
                key={item.previewId}
                className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{item.sourceUrl}</p>
                      <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                      <Badge variant={item.feedback.reviewCount > 0 ? "secondary" : "outline"}>
                        {t("dashboard.ops.previews.badges.reviews", "{count} review(s)", {
                          count: String(item.feedback.reviewCount),
                        })}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.previewId", "Preview ID")}
                        value={item.previewId}
                      />
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.languages", "Languages")}
                        value={`${item.sourceLang} → ${item.targetLang}`}
                      />
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.created", "Created")}
                        value={formatDateTime(item.createdAt)}
                      />
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.latestReview", "Latest review")}
                        value={formatDateTime(item.feedback.latestSubmittedAt)}
                      />
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.stage", "Stage")}
                        value={item.stageLast ?? "—"}
                      />
                      <InfoRow
                        label={t("dashboard.ops.previews.fields.error", "Error")}
                        value={item.errorCode ?? "—"}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-56">
                    <Button asChild variant="secondary">
                      <Link href={`/dashboard/ops/previews/${encodeURIComponent(item.previewId)}`}>
                        {t("dashboard.ops.previews.actions.viewReviews", "View reviews")}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className={!item.previewUrl ? "pointer-events-none opacity-60" : undefined}
                    >
                      <Link href={item.previewUrl ?? "#"} target="_blank" rel="noreferrer">
                        {t("dashboard.ops.previews.actions.openPreview", "Open preview")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              {t(
                "dashboard.ops.previews.pagination.note",
                "Pagination is deterministic: created-at-desc, then preview-id-desc.",
              )}
            </p>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                className={!previousHref ? "pointer-events-none opacity-60" : undefined}
              >
                <Link href={previousHref ?? "#"}>
                  {t("dashboard.ops.previews.pagination.previous", "Previous")}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className={!nextHref ? "pointer-events-none opacity-60" : undefined}
              >
                <Link href={nextHref ?? "#"}>
                  {t("dashboard.ops.previews.pagination.next", "Next")}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
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
