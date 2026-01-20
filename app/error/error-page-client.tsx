"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ErrorPageClient() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const trace = searchParams.get("trace");
  const isProd = process.env.NODE_ENV === "production";

  const title = useMemo(() => {
    if (message && /account not found/i.test(message)) {
      return "Account not provisioned";
    }
    return "Something went wrong";
  }, [message]);

  const safeTrace = useMemo(() => {
    if (!trace || isProd) {
      return null;
    }
    const trimmed = trace.trim();
    if (!trimmed) {
      return null;
    }
    const cleaned = trimmed.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
    if (!cleaned) {
      return null;
    }
    return cleaned.length > 2000 ? `${cleaned.slice(0, 2000)}...` : cleaned;
  }, [trace, isProd]);

  useEffect(() => {
    const context = {
      href: typeof window !== "undefined" ? window.location.href : "unknown",
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
      searchParams: Object.fromEntries(searchParams.entries()),
    };

    console.group("Error page diagnostics");
    console.error("Message:", message ?? "(none)");
    if (trace) console.error("Trace:", trace);
    console.info("Context:", context);
    console.groupEnd();
  }, [message, trace, searchParams]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                We hit an unexpected issue while processing your request. You can retry, sign in
                again, or head back to the dashboard/homepage.
              </CardDescription>
            </div>
            <Badge variant="outline">Status: error</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-destructive">
            {message ?? "Sorry, something went wrong."}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="link">
              <a href="mailto:contact@weblingo.app">Contact support</a>
            </Button>
          </div>

          {safeTrace ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                User-provided debug info
              </p>
              <pre className="max-h-[320px] overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
                {safeTrace}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
