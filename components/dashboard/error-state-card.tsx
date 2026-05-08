"use client";

import type { ReactNode } from "react";

import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ErrorStateCardProps = {
  title: string;
  description: string;
  message: ReactNode;
  nextSteps?: string[];
  referenceCode?: string | null;
  technicalDetails?: unknown | null;
  actions?: ReactNode;
  children?: ReactNode;
  headerBadge?: ReactNode;
  className?: string;
  messageClassName?: string;
};

export function ErrorStateCard({
  title,
  description,
  message,
  nextSteps,
  referenceCode,
  technicalDetails,
  actions,
  children,
  headerBadge,
  className,
  messageClassName,
}: ErrorStateCardProps) {
  const recoverySteps = nextSteps?.filter(Boolean) ?? [];
  const formattedTechnicalDetails =
    technicalDetails === null || technicalDetails === undefined
      ? null
      : JSON.stringify(technicalDetails, null, 2);
  return (
    <Card className={cn("max-w-5xl overflow-hidden border-amber-200/80 bg-card", className)}>
      <div className="h-1 bg-amber-500" />
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-xl text-foreground">{title}</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                {description}
              </CardDescription>
            </div>
          </div>
          {headerBadge ? <div className="shrink-0">{headerBadge}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section
            className={cn(
              "rounded-md border border-border bg-background p-4 text-sm text-foreground",
              messageClassName,
            )}
            aria-label="What happened"
          >
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              What happened
            </p>
            <div className="mt-2 leading-6">{message}</div>
            {referenceCode ? (
              <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
                <span className="font-semibold uppercase tracking-normal text-muted-foreground">
                  Error code
                </span>
                <span className="break-all font-mono text-foreground">{referenceCode}</span>
              </div>
            ) : null}
            {formattedTechnicalDetails ? (
              <details className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                <summary className="cursor-pointer text-xs font-medium text-foreground">
                  Show raw server details
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                  {formattedTechnicalDetails}
                </pre>
              </details>
            ) : null}
          </section>
          <section
            className="rounded-md border border-border bg-muted/20 p-4 text-sm"
            aria-label="What you can do"
          >
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              What you can do
            </p>
            {recoverySteps.length ? (
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-foreground">
                {recoverySteps.map((step, index) => (
                  <li key={`${index}:${step}`} className="leading-6">
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 leading-6 text-foreground">
                Retry the request, then return to the dashboard if the problem continues.
              </p>
            )}
          </section>
        </div>
        {children}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
