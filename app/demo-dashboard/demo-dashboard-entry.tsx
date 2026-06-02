"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, MonitorPlay } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ClaimState =
  | { status: "idle" | "loading" }
  | { status: "ready"; payload: DemoClaimPayload }
  | { status: "error"; message: string };

type ConversionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "converted"; message: string }
  | { status: "error"; message: string };

type DemoClaimPayload = {
  token: string;
  expiresAt: string;
  prospectShowcaseRef: string;
  siteId: string;
  conversionToken: string;
  demo: true;
};

const emailSchema = z.email();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClaimPayload(value: unknown): DemoClaimPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.token !== "string" ||
    typeof value.expiresAt !== "string" ||
    typeof value.prospectShowcaseRef !== "string" ||
    typeof value.siteId !== "string" ||
    typeof value.conversionToken !== "string" ||
    value.demo !== true
  ) {
    return null;
  }
  return {
    token: value.token,
    expiresAt: value.expiresAt,
    prospectShowcaseRef: value.prospectShowcaseRef,
    siteId: value.siteId,
    conversionToken: value.conversionToken,
    demo: true,
  };
}

function parseErrorMessage(value: unknown, fallback: string): string {
  if (isRecord(value) && typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }
  if (isRecord(value) && typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }
  return fallback;
}

export function DemoDashboardEntry({ accessToken }: { accessToken: string }) {
  const trimmedToken = accessToken.trim();
  const [claimState, setClaimState] = useState<ClaimState>({
    status: trimmedToken ? "loading" : "idle",
  });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [conversionState, setConversionState] = useState<ConversionState>({ status: "idle" });

  const effectiveClaimState: ClaimState = trimmedToken
    ? claimState
    : { status: "error", message: "Missing demo access token." };
  const payload = effectiveClaimState.status === "ready" ? effectiveClaimState.payload : null;
  const expiresAt = useMemo(() => {
    if (!payload) {
      return null;
    }
    const parsed = Date.parse(payload.expiresAt);
    return Number.isFinite(parsed)
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(parsed)
      : payload.expiresAt;
  }, [payload]);

  useEffect(() => {
    if (!trimmedToken) {
      return;
    }

    let canceled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/prospect-showcases/claim?token=${encodeURIComponent(trimmedToken)}`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => null);
        if (canceled) {
          return;
        }
        if (!response.ok) {
          setClaimState({
            status: "error",
            message: parseErrorMessage(body, "Demo access link is not available."),
          });
          return;
        }
        const parsed = parseClaimPayload(body);
        if (!parsed) {
          setClaimState({ status: "error", message: "Demo access response was invalid." });
          return;
        }
        setClaimState({ status: "ready", payload: parsed });
      } catch {
        if (!canceled) {
          setClaimState({ status: "error", message: "Unable to open demo dashboard." });
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [trimmedToken]);

  async function handleConvert() {
    if (!payload) {
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailSchema.safeParse(normalizedEmail).success) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setConversionState({ status: "submitting" });
    try {
      const response = await fetch(
        `/api/prospect-showcases/${encodeURIComponent(payload.prospectShowcaseRef)}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            conversionToken: payload.conversionToken,
            dashboardToken: payload.token,
          }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setConversionState({
          status: "error",
          message: parseErrorMessage(body, "Could not start domain activation."),
        });
        return;
      }
      setConversionState({
        status: "converted",
        message: "Demo locked for activation. Complete payment to publish on your domain.",
      });
    } catch {
      setConversionState({ status: "error", message: "Could not start domain activation." });
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                Demo workspace
              </Badge>
              {payload ? <Badge variant="secondary">Scoped access</Badge> : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">WebLingo demo dashboard</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review the translated showcase and publish it on your domain when you are ready.
            </p>
          </div>
        </div>

        {effectiveClaimState.status === "loading" || effectiveClaimState.status === "idle" ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Opening demo workspace...</span>
            </CardContent>
          </Card>
        ) : null}

        {effectiveClaimState.status === "error" ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>Demo link unavailable</CardTitle>
              <CardDescription>{effectiveClaimState.message}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {payload ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MonitorPlay className="h-5 w-5 text-primary" />
                  <CardTitle>Demo site</CardTitle>
                </div>
                <CardDescription>
                  This workspace is scoped to one translated showcase and cannot add other sites.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border px-3 py-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Showcase ref
                  </div>
                  <div className="mt-1 break-all text-sm font-medium">
                    {payload.prospectShowcaseRef}
                  </div>
                </div>
                <div className="rounded-md border border-border px-3 py-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Site ID</div>
                  <div className="mt-1 break-all text-sm font-medium">{payload.siteId}</div>
                </div>
                <div className="rounded-md border border-border px-3 py-3 sm:col-span-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Access expires
                  </div>
                  <div className="mt-1 text-sm font-medium">{expiresAt ?? payload.expiresAt}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <CardTitle>Publish on my domain</CardTitle>
                </div>
                <CardDescription>
                  Conversion creates a new locked account and starts activation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversionState.status === "converted" ? (
                  <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-3 text-sm text-primary">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Activation started
                    </div>
                    <p className="mt-1 text-primary/85">{conversionState.message}</p>
                  </div>
                ) : (
                  <>
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium">Account email</span>
                      <Input
                        value={email}
                        onChange={(event) => {
                          setEmail(event.currentTarget.value);
                          if (emailError) {
                            setEmailError(null);
                          }
                        }}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        disabled={conversionState.status === "submitting"}
                      />
                    </label>
                    {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
                    {conversionState.status === "error" ? (
                      <p className="text-sm text-destructive">{conversionState.message}</p>
                    ) : null}
                    <Button
                      type="button"
                      onClick={() => void handleConvert()}
                      disabled={conversionState.status === "submitting" || !email.trim()}
                      className="w-full"
                    >
                      {conversionState.status === "submitting"
                        ? "Starting activation..."
                        : "Publish on my domain"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}
