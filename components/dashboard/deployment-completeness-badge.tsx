import type { DeploymentCompleteness } from "@internal/dashboard/webhooks";
import { Badge } from "@/components/ui/badge";

type DeploymentCompletenessBadgeProps = {
  completeness: DeploymentCompleteness;
};

export function DeploymentCompletenessBadge({ completeness }: DeploymentCompletenessBadgeProps) {
  const label = buildStatusLabel(completeness);
  const variant = resolveStatusVariant(completeness.status);
  const details =
    completeness.status === "unknown"
      ? "Unable to derive translated page coverage from this deployment artifact."
      : `${completeness.translatedPages}/${completeness.discoveredPages} pages translated`;
  const warning =
    completeness.status === "partial"
      ? `${completeness.pendingPages} pages still pending translation coverage.`
      : completeness.status === "not_started"
        ? "No translated pages have been deployed yet."
        : null;

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={variant}>{label}</Badge>
      <p className="text-xs text-muted-foreground">{details}</p>
      {warning ? <p className="text-xs text-destructive">{warning}</p> : null}
    </div>
  );
}

function buildStatusLabel(completeness: DeploymentCompleteness): string {
  switch (completeness.status) {
    case "complete":
      return `Complete (${completeness.percentage}%)`;
    case "partial":
      return `Partial (${completeness.percentage}%)`;
    case "not_started":
      return "Not started (0%)";
    case "unknown":
    default:
      return "Coverage unknown";
  }
}

function resolveStatusVariant(status: DeploymentCompleteness["status"]) {
  switch (status) {
    case "complete":
      return "secondary";
    case "partial":
      return "outline";
    case "not_started":
      return "outline";
    case "unknown":
    default:
      return "destructive";
  }
}
