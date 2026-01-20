import * as React from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  labelAction?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  htmlFor,
  labelAction,
  description,
  error,
  className,
  children,
}: FieldProps) {
  const labelContent = label ? (
    htmlFor ? (
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
    ) : (
      <div className="text-sm font-medium text-foreground">{label}</div>
    )
  ) : null;

  return (
    <div className={cn("space-y-2", className)}>
      {labelContent || labelAction ? (
        <div className="flex items-center justify-between gap-3">
          {labelContent}
          {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
        </div>
      ) : null}
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
