import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const exampleFieldClassName =
  "border-sky-200 bg-sky-50/80 text-sky-950 disabled:cursor-default disabled:opacity-100";

export function ExampleValuesBadge({
  className,
  label = "Example values",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-sky-200 bg-sky-50 text-sky-800", className)}>
      {label}
    </Badge>
  );
}
