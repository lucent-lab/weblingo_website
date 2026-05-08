import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NextActionSeverity = "none" | "info" | "warning" | "danger";

const SEVERITY_TONES: Record<NextActionSeverity, StatusTone> = {
  none: "success",
  info: "info",
  warning: "warning",
  danger: "danger",
};

export function NextActionCard({
  ctaHref,
  ctaLabel,
  description,
  severity,
  title,
}: {
  ctaHref?: string | null;
  ctaLabel?: string | null;
  description?: string | null;
  severity: NextActionSeverity;
  title: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <StatusBadge tone={SEVERITY_TONES[severity]}>
          {severity === "none" ? "ready" : severity}
        </StatusBadge>
      </CardHeader>
      {ctaHref && ctaLabel ? (
        <CardContent>
          <Button asChild size="sm" variant={severity === "danger" ? "default" : "outline"}>
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
