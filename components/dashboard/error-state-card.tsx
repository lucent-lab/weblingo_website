"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ErrorStateCardProps = {
  title: string;
  description: string;
  message: ReactNode;
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
  actions,
  children,
  headerBadge,
  className,
  messageClassName,
}: ErrorStateCardProps) {
  return (
    <Card className={cn("border-destructive/40 bg-destructive/5", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-destructive">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {headerBadge ? <div>{headerBadge}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "rounded-lg border border-border bg-background px-4 py-3 text-sm text-destructive",
            messageClassName,
          )}
        >
          {message}
        </div>
        {children}
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
