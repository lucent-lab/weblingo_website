import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";

const STATUS_TONE_CLASSNAMES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: StatusTone;
}) {
  return (
    <Badge className={cn("border", STATUS_TONE_CLASSNAMES[tone], className)} variant="outline">
      {children}
    </Badge>
  );
}
