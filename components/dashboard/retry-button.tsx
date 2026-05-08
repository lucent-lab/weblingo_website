"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DashboardRetryButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      onClick={() => {
        window.location.assign(href);
      }}
      type="button"
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
