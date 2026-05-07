import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

type QuotaStatus = "ok" | "near_limit" | "reached" | "unknown";

const QUOTA_TONES: Record<QuotaStatus, StatusTone> = {
  ok: "success",
  near_limit: "warning",
  reached: "danger",
  unknown: "neutral",
};

export function QuotaMeter({
  label,
  limit,
  remaining,
  status,
  used,
}: {
  label: string;
  limit?: number | null;
  remaining?: number | null;
  status: QuotaStatus;
  used?: number | null;
}) {
  const hasBoundedLimit = typeof limit === "number" && limit > 0;
  const normalizedUsed = typeof used === "number" ? used : 0;
  const percent = hasBoundedLimit ? Math.min(100, Math.max(0, (normalizedUsed / limit) * 100)) : 0;
  const usageLabel = hasBoundedLimit
    ? `${normalizedUsed} / ${limit}`
    : typeof used === "number"
      ? `${used} used`
      : "Usage unavailable";
  const remainingLabel =
    typeof remaining === "number" ? `${remaining} remaining` : hasBoundedLimit ? "" : "No limit";

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{usageLabel}</p>
        </div>
        <StatusBadge tone={QUOTA_TONES[status]}>{status.replace("_", " ")}</StatusBadge>
      </div>
      <div
        aria-label={`${label} quota usage`}
        aria-valuemax={hasBoundedLimit ? limit : undefined}
        aria-valuemin={hasBoundedLimit ? 0 : undefined}
        aria-valuenow={hasBoundedLimit ? normalizedUsed : undefined}
        className="h-2 overflow-hidden rounded-full bg-muted"
        role={hasBoundedLimit ? "progressbar" : undefined}
      >
        <div
          className={cn(
            "h-full rounded-full",
            status === "reached"
              ? "bg-destructive"
              : status === "near_limit"
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: hasBoundedLimit ? `${percent}%` : "100%" }}
        />
      </div>
      {remainingLabel ? <p className="text-xs text-muted-foreground">{remainingLabel}</p> : null}
    </div>
  );
}
