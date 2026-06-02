"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, MonitorPlay } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClientTranslator, type ClientMessages } from "@internal/i18n/client";
import type { Translator } from "@internal/i18n";

type ClaimState =
  | { status: "idle" | "loading" }
  | { status: "ready"; payload: DemoClaimPayload }
  | { status: "error"; message: string };

type ConversionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "result"; payload: DemoConversionPayload }
  | { status: "error"; message: string };

type DemoClaimPayload = {
  token: string;
  expiresAt: string;
  prospectShowcaseRef: string;
  siteId: string;
  conversionToken: string;
  demo: true;
};

type DemoConversionStatus =
  | "checkout_pending"
  | "activation_pending"
  | "payment_failed"
  | "converted";

type DemoConversionPayload = {
  prospectShowcaseRef: string;
  status: DemoConversionStatus;
  activationStatus: string;
  locked: boolean;
  lockedReason: string;
  accountId: string;
  siteId: string;
  nextAction: string;
};

const emailSchema = z.email();
const DEMO_CLAIM_SESSION_STORAGE_KEY = "weblingo:demo-dashboard:claim:v1";

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

function parseConversionPayload(value: unknown): DemoConversionPayload | null {
  if (!isRecord(value) || !isDemoConversionStatus(value.status)) {
    return null;
  }
  if (
    typeof value.prospectShowcaseRef !== "string" ||
    typeof value.activationStatus !== "string" ||
    typeof value.locked !== "boolean" ||
    typeof value.lockedReason !== "string" ||
    typeof value.accountId !== "string" ||
    typeof value.siteId !== "string" ||
    typeof value.nextAction !== "string"
  ) {
    return null;
  }
  return {
    prospectShowcaseRef: value.prospectShowcaseRef,
    status: value.status,
    activationStatus: value.activationStatus,
    locked: value.locked,
    lockedReason: value.lockedReason,
    accountId: value.accountId,
    siteId: value.siteId,
    nextAction: value.nextAction,
  };
}

function isDemoConversionStatus(value: unknown): value is DemoConversionStatus {
  return (
    value === "checkout_pending" ||
    value === "activation_pending" ||
    value === "payment_failed" ||
    value === "converted"
  );
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

function isFreshClaimPayload(payload: DemoClaimPayload): boolean {
  const expiresAt = Date.parse(payload.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function readStoredDemoClaimPayload(): DemoClaimPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DEMO_CLAIM_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = parseClaimPayload(JSON.parse(raw));
    if (!parsed || !isFreshClaimPayload(parsed)) {
      clearStoredDemoClaimPayload();
      return null;
    }
    return parsed;
  } catch {
    clearStoredDemoClaimPayload();
    return null;
  }
}

function storeDemoClaimPayload(payload: DemoClaimPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(DEMO_CLAIM_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    window.sessionStorage.removeItem(DEMO_CLAIM_SESSION_STORAGE_KEY);
  }
}

function clearStoredDemoClaimPayload(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DEMO_CLAIM_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the claim request remains the source of truth.
  }
}

function scrubDemoAccessTokenFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token")) {
    return;
  }
  url.searchParams.delete("token");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function getConversionResultCopy(t: Translator, status: DemoConversionStatus) {
  switch (status) {
    case "checkout_pending":
      return {
        title: t("dashboard.demo.conversion.checkoutPending.title"),
        message: t("dashboard.demo.conversion.checkoutPending.message"),
      };
    case "activation_pending":
      return {
        title: t("dashboard.demo.conversion.activationPending.title"),
        message: t("dashboard.demo.conversion.activationPending.message"),
      };
    case "payment_failed":
      return {
        title: t("dashboard.demo.conversion.paymentFailed.title"),
        message: t("dashboard.demo.conversion.paymentFailed.message"),
      };
    case "converted":
      return {
        title: t("dashboard.demo.conversion.converted.title"),
        message: t("dashboard.demo.conversion.converted.message"),
      };
  }
}

function getConversionNextActionCopy(t: Translator, nextAction?: string): string | null {
  switch (nextAction) {
    case "complete_payment":
      return t("dashboard.demo.conversion.nextAction.completePayment");
    case "wait_for_activation":
      return t("dashboard.demo.conversion.nextAction.waitForActivation");
    case "retry_payment":
      return t("dashboard.demo.conversion.nextAction.retryPayment");
    case "open_dashboard":
      return t("dashboard.demo.conversion.nextAction.openDashboard");
    case undefined:
      return null;
    default:
      return t("dashboard.demo.conversion.nextAction.unknown", undefined, {
        action: nextAction,
      });
  }
}

export function DemoDashboardEntry({
  accessToken,
  messages,
}: {
  accessToken: string;
  messages: ClientMessages;
}) {
  const trimmedToken = accessToken.trim();
  return <DemoDashboardSession key={trimmedToken} accessToken={trimmedToken} messages={messages} />;
}

function DemoDashboardSession({
  accessToken: trimmedToken,
  messages,
}: {
  accessToken: string;
  messages: ClientMessages;
}) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [claimState, setClaimState] = useState<ClaimState>(() => {
    if (trimmedToken) {
      return { status: "loading" };
    }
    const stored = readStoredDemoClaimPayload();
    return stored ? { status: "ready", payload: stored } : { status: "idle" };
  });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [conversionState, setConversionState] = useState<ConversionState>({ status: "idle" });

  const effectiveClaimState: ClaimState =
    trimmedToken || claimState.status === "ready"
      ? claimState
      : { status: "error", message: t("dashboard.demo.error.missingToken") };
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
        const response = await fetch("/api/prospect-showcases/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: trimmedToken }),
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        if (canceled) {
          return;
        }
        if (!response.ok) {
          setClaimState({
            status: "error",
            message: parseErrorMessage(body, t("dashboard.demo.error.claimUnavailable")),
          });
          return;
        }
        const parsed = parseClaimPayload(body);
        if (!parsed) {
          clearStoredDemoClaimPayload();
          setClaimState({ status: "error", message: t("dashboard.demo.error.invalidClaim") });
          return;
        }
        storeDemoClaimPayload(parsed);
        scrubDemoAccessTokenFromLocation();
        setClaimState({ status: "ready", payload: parsed });
      } catch {
        if (!canceled) {
          setClaimState({ status: "error", message: t("dashboard.demo.error.openFailed") });
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [trimmedToken, t]);

  async function handleConvert() {
    if (!payload) {
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailSchema.safeParse(normalizedEmail).success) {
      setEmailError(t("dashboard.demo.form.emailInvalid"));
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
          message: parseErrorMessage(body, t("dashboard.demo.error.convertFailed")),
        });
        return;
      }
      const parsed = parseConversionPayload(body);
      if (!parsed) {
        setConversionState({
          status: "error",
          message: t("dashboard.demo.error.invalidConversion"),
        });
        return;
      }
      setConversionState({ status: "result", payload: parsed });
    } catch {
      setConversionState({ status: "error", message: t("dashboard.demo.error.convertFailed") });
    }
  }

  const conversionResultCopy =
    conversionState.status === "result"
      ? getConversionResultCopy(t, conversionState.payload.status)
      : null;
  const conversionNextActionCopy =
    conversionState.status === "result"
      ? getConversionNextActionCopy(t, conversionState.payload.nextAction)
      : null;
  const conversionResultTone =
    conversionState.status === "result" && conversionState.payload.status === "payment_failed"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-primary/25 bg-primary/10 text-primary";
  const conversionIsTerminal =
    conversionState.status === "result" && conversionState.payload.status === "converted";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                {t("dashboard.demo.badge.workspace")}
              </Badge>
              {payload ? (
                <Badge variant="secondary">{t("dashboard.demo.badge.scoped")}</Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">{t("dashboard.demo.title")}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("dashboard.demo.description")}
            </p>
          </div>
        </div>

        {effectiveClaimState.status === "loading" || effectiveClaimState.status === "idle" ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{t("dashboard.demo.loading")}</span>
            </CardContent>
          </Card>
        ) : null}

        {effectiveClaimState.status === "error" ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle>{t("dashboard.demo.error.title")}</CardTitle>
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
                  <CardTitle>{t("dashboard.demo.site.title")}</CardTitle>
                </div>
                <CardDescription>{t("dashboard.demo.site.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border px-3 py-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {t("dashboard.demo.site.showcaseRef")}
                  </div>
                  <div className="mt-1 break-all text-sm font-medium">
                    {payload.prospectShowcaseRef}
                  </div>
                </div>
                <div className="rounded-md border border-border px-3 py-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {t("dashboard.demo.site.siteId")}
                  </div>
                  <div className="mt-1 break-all text-sm font-medium">{payload.siteId}</div>
                </div>
                <div className="rounded-md border border-border px-3 py-3 sm:col-span-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {t("dashboard.demo.site.accessExpires")}
                  </div>
                  <div className="mt-1 text-sm font-medium">{expiresAt ?? payload.expiresAt}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <CardTitle>{t("dashboard.demo.publish.title")}</CardTitle>
                </div>
                <CardDescription>{t("dashboard.demo.publish.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversionState.status === "result" && conversionResultCopy ? (
                  <div className={`rounded-md border px-3 py-3 text-sm ${conversionResultTone}`}>
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {conversionResultCopy.title}
                    </div>
                    <p className="mt-1 opacity-85">{conversionResultCopy.message}</p>
                    {conversionNextActionCopy ? (
                      <p className="mt-2 text-xs font-medium">
                        {t("dashboard.demo.conversion.nextAction.label")}:{" "}
                        {conversionNextActionCopy}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {!conversionIsTerminal ? (
                  <>
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium">{t("dashboard.demo.form.emailLabel")}</span>
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
                        placeholder={t("dashboard.demo.form.emailPlaceholder")}
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
                        ? t("dashboard.demo.form.submitting")
                        : t("dashboard.demo.form.submit")}
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}
