import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasActorInternalOps, requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";
import {
  getAdminPreview,
  WebhooksApiError,
  type AdminPreviewReview,
} from "@internal/dashboard/webhooks";

type OpsPreviewDetailPageProps = {
  params: Promise<{ previewId: string }>;
};

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

export async function generateMetadata() {
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  return {
    title: t("dashboard.ops.previewDetail.meta.title", "Preview review detail"),
    robots: { index: false, follow: false },
  };
}

export default async function OpsPreviewDetailPage({ params }: OpsPreviewDetailPageProps) {
  const { previewId } = await params;
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    notFound();
  }
  const actorAuth = auth.actorWebhooksAuth ?? auth.webhooksAuth;
  if (!actorAuth) {
    notFound();
  }

  let payload: Awaited<ReturnType<typeof getAdminPreview>>;
  try {
    payload = await getAdminPreview(actorAuth, previewId);
  } catch (error) {
    if (error instanceof WebhooksApiError && (error.status === 400 || error.status === 404)) {
      notFound();
    }
    throw error;
  }

  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const preview = payload.preview;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">
            {t("dashboard.ops.previewDetail.heading", "Preview review detail")}
          </h2>
          <Badge variant="outline">
            {t("dashboard.ops.badge.internalAdmin", "Internal admin")}
          </Badge>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t(
            "dashboard.ops.previewDetail.intro",
            "See the preview context and every structured review for this preview on one page.",
          )}
        </p>
      </div>

      <Card className="border-border/60 bg-muted/20">
        <CardHeader>
          <CardTitle>{preview.sourceUrl}</CardTitle>
          <CardDescription>{preview.previewId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={preview.status === "ready" ? "secondary" : "outline"}>
              {preview.status}
            </Badge>
            <Badge variant={preview.feedback.reviewCount > 0 ? "secondary" : "outline"}>
              {t("dashboard.ops.previewDetail.badges.reviews", "{count} review(s)", {
                count: String(preview.feedback.reviewCount),
              })}
            </Badge>
            <Badge variant="outline">{`${preview.sourceLang} → ${preview.targetLang}`}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/ops/previews">
                {t("dashboard.ops.previewDetail.actions.back", "Back to previews")}
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className={!preview.previewUrl ? "pointer-events-none opacity-60" : undefined}
            >
              <Link href={preview.previewUrl ?? "#"} target="_blank" rel="noreferrer">
                {t("dashboard.ops.previewDetail.actions.openPreview", "Open preview")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.ops.previewDetail.preview.title", "Preview context")}</CardTitle>
          <CardDescription>
            {t(
              "dashboard.ops.previewDetail.preview.description",
              "Current preview metadata captured from the backend preview record.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.sourceUrl", "Source URL")}
            value={preview.sourceUrl}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.languages", "Languages")}
            value={`${preview.sourceLang} → ${preview.targetLang}`}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.created", "Created")}
            value={formatDateTime(preview.createdAt)}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.updated", "Updated")}
            value={formatDateTime(preview.updatedAt)}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.readyAt", "Ready at")}
            value={formatDateTime(preview.readyAt)}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.expiresAt", "Expires at")}
            value={formatDateTime(preview.expiresAt)}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.stage", "Stage")}
            value={preview.stageLast ?? "—"}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.errorCode", "Error code")}
            value={preview.errorCode ?? "—"}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.errorStage", "Error stage")}
            value={preview.errorStage ?? "—"}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.errorMessage", "Error message")}
            value={preview.error ?? "—"}
          />
          <InfoRow
            label={t("dashboard.ops.previewDetail.fields.latestReview", "Latest review")}
            value={formatDateTime(preview.feedback.latestSubmittedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.ops.previewDetail.reviews.title", "Reviews")}</CardTitle>
          <CardDescription>
            {t(
              "dashboard.ops.previewDetail.reviews.description",
              "Newest reviews first, with the preview outcome snapshot preserved at submit time.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              {t(
                "dashboard.ops.previewDetail.reviews.empty",
                "No reviews have been submitted for this preview yet.",
              )}
            </div>
          ) : (
            payload.reviews.map((review) => <ReviewCard key={review.id} review={review} t={t} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewCard({
  review,
  t,
}: {
  review: AdminPreviewReview;
  t: Awaited<ReturnType<typeof resolveLocaleTranslator>>["t"];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("dashboard.ops.previewDetail.review.translation", "Translation {score}/5", {
            score: String(review.translationRating),
          })}
        </Badge>
        <Badge variant="outline">
          {t("dashboard.ops.previewDetail.review.design", "Design {score}/5", {
            score: String(review.designRating),
          })}
        </Badge>
        <Badge variant="outline">{review.previewStatusAtSubmit}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <InfoRow
          label={t("dashboard.ops.previewDetail.review.submittedAt", "Submitted")}
          value={formatDateTime(review.submittedAt)}
        />
        <InfoRow
          label={t("dashboard.ops.previewDetail.review.stage", "Stage")}
          value={review.previewStageAtSubmit ?? "—"}
        />
        <InfoRow
          label={t("dashboard.ops.previewDetail.review.errorCode", "Error code")}
          value={review.previewErrorCodeAtSubmit ?? "—"}
        />
        <InfoRow
          label={t("dashboard.ops.previewDetail.review.origin", "Origin")}
          value={review.originUrl ?? "—"}
        />
      </div>
      <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
        {review.comment ??
          t("dashboard.ops.previewDetail.review.noComment", "No comment submitted.")}
      </div>
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
