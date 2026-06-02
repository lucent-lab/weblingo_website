"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, LoaderCircle, LockKeyhole, MonitorPlay } from "lucide-react";
import { useSearchParams } from "next/navigation";
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

type AccessLinkResendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; message: string }
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
const DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY = "weblingo:demo-dashboard:access-token:v1";
const DEMO_CLAIM_SESSION_STORAGE_KEY = "weblingo:demo-dashboard:claim:v1";
const DEMO_CONVERSION_SESSION_STORAGE_KEY = "weblingo:demo-dashboard:conversion:v1";

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

function parseStoredConversionPayload(
  value: unknown,
  claim: DemoClaimPayload,
): DemoConversionPayload | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.claimToken !== claim.token ||
    value.conversionToken !== claim.conversionToken ||
    value.prospectShowcaseRef !== claim.prospectShowcaseRef
  ) {
    return null;
  }
  return parseConversionPayload(value.payload);
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

function readStoredDemoAccessToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.sessionStorage.getItem(DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function hasStoredDemoClaimPayload(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(DEMO_CLAIM_SESSION_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function storeDemoAccessToken(rawToken: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY, rawToken);
  } catch {
    window.sessionStorage.removeItem(DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY);
  }
}

function clearStoredDemoAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the URL has already been scrubbed.
  }
}

function readStoredDemoConversionPayload(claim: DemoClaimPayload): DemoConversionPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DEMO_CONVERSION_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = parseStoredConversionPayload(JSON.parse(raw), claim);
    if (!parsed) {
      clearStoredDemoConversionPayload();
      return null;
    }
    return parsed;
  } catch {
    clearStoredDemoConversionPayload();
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
    window.sessionStorage.removeItem(DEMO_CONVERSION_SESSION_STORAGE_KEY);
  }
}

function storeDemoConversionPayload(claim: DemoClaimPayload, payload: DemoConversionPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      DEMO_CONVERSION_SESSION_STORAGE_KEY,
      JSON.stringify({
        claimToken: claim.token,
        conversionToken: claim.conversionToken,
        prospectShowcaseRef: claim.prospectShowcaseRef,
        payload,
      }),
    );
  } catch {
    clearStoredDemoConversionPayload();
  }
}

function clearStoredDemoClaimPayload(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DEMO_ACCESS_TOKEN_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(DEMO_CLAIM_SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(DEMO_CONVERSION_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the claim request remains the source of truth.
  }
}

function clearStoredDemoConversionPayload(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DEMO_CONVERSION_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the backend conversion response remains authoritative.
  }
}

function readDemoAccessTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const queryToken = new URL(window.location.href).searchParams.get("token")?.trim() ?? "";
  if (queryToken) {
    return queryToken;
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return "";
  }
  try {
    return new URLSearchParams(hash).get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}

function scrubDemoAccessTokenFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  const hadQueryToken = url.searchParams.has("token");
  if (hadQueryToken) {
    url.searchParams.delete("token");
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  let nextHash = url.hash;
  let hadHashToken = false;
  if (hash) {
    try {
      const hashParams = new URLSearchParams(hash);
      hadHashToken = hashParams.has("token");
      if (hadHashToken) {
        hashParams.delete("token");
        const serialized = hashParams.toString();
        nextHash = serialized ? `#${serialized}` : "";
      }
    } catch {
      hadHashToken = false;
    }
  }

  if (!hadQueryToken && !hadHashToken) {
    return;
  }
  url.hash = nextHash;
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

function buildCustomerWorkspaceHref(siteId: string): string | null {
  const trimmedSiteId = siteId.trim();
  if (!trimmedSiteId) {
    return null;
  }
  return `/dashboard/sites/${encodeURIComponent(trimmedSiteId)}`;
}

function getConversionAction(
  t: Translator,
  payload: DemoConversionPayload,
): { href: string; label: string } | null {
  const href = buildCustomerWorkspaceHref(payload.siteId);
  if (!href) {
    return null;
  }
  switch (payload.nextAction) {
    case "complete_payment":
      return { href, label: t("dashboard.demo.conversion.action.completePayment") };
    case "retry_payment":
      return { href, label: t("dashboard.demo.conversion.action.retryPayment") };
    case "wait_for_activation":
    case "open_dashboard":
      return { href, label: t("dashboard.demo.conversion.action.openDashboard") };
    default:
      return { href, label: t("dashboard.demo.conversion.action.openDashboard") };
  }
}

type AccessTokenInput = string | readonly string[] | null | undefined;

function normalizeAccessToken(accessToken: AccessTokenInput): string {
  const value = Array.isArray(accessToken) ? accessToken[0] : accessToken;
  return typeof value === "string" ? value.trim() : "";
}

export function DemoDashboardEntry({
  accessToken = "",
  messages,
}: {
  accessToken?: AccessTokenInput;
  messages: ClientMessages;
}) {
  const searchParams = useSearchParams();
  const trimmedToken =
    normalizeAccessToken(accessToken) || normalizeAccessToken(searchParams.get("token"));
  return <DemoDashboardSession accessToken={trimmedToken} messages={messages} />;
}

function DemoDashboardSession({
  accessToken: trimmedToken,
  messages,
}: {
  accessToken: string;
  messages: ClientMessages;
}) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [claimAccessToken, setClaimAccessToken] = useState(trimmedToken);
  const [claimState, setClaimState] = useState<ClaimState>(
    trimmedToken ? { status: "loading" } : { status: "idle" },
  );
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [conversionState, setConversionState] = useState<ConversionState>({ status: "idle" });
  const [accessLinkResendState, setAccessLinkResendState] = useState<AccessLinkResendState>({
    status: "idle",
  });
  const [clientRestoreComplete, setClientRestoreComplete] = useState(Boolean(trimmedToken));
  const handledExternalTokenRef = useRef(trimmedToken);

  const effectiveClaimState: ClaimState = !clientRestoreComplete
    ? { status: "loading" }
    : claimAccessToken || claimState.status === "ready" || claimState.status === "error"
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
  const expireCurrentDemoClaim = useCallback(() => {
    clearStoredDemoAccessToken();
    clearStoredDemoClaimPayload();
    setConversionState({ status: "idle" });
    setClaimAccessToken("");
    setClaimState({ status: "error", message: t("dashboard.demo.error.expired") });
  }, [t]);

  useEffect(() => {
    if (trimmedToken) {
      if (handledExternalTokenRef.current !== trimmedToken) {
        let canceled = false;
        const nextToken = trimmedToken;
        handledExternalTokenRef.current = nextToken;
        queueMicrotask(() => {
          if (canceled) {
            return;
          }
          setClaimAccessToken(nextToken);
          setClaimState({ status: "loading" });
          setConversionState({ status: "idle" });
          setClientRestoreComplete(true);
        });
        scrubDemoAccessTokenFromLocation();
        return () => {
          canceled = true;
        };
      }
      scrubDemoAccessTokenFromLocation();
      return;
    }

    let canceled = false;
    const restoreLocationAccessToken = () => {
      const locationAccessToken = readDemoAccessTokenFromLocation();
      if (!locationAccessToken) {
        return false;
      }
      scrubDemoAccessTokenFromLocation();
      setClaimAccessToken(locationAccessToken);
      setClaimState({ status: "loading" });
      setConversionState({ status: "idle" });
      setClientRestoreComplete(true);
      return true;
    };
    const restoreStoredSession = () => {
      const hadStoredClaim = hasStoredDemoClaimPayload();
      const storedClaim = readStoredDemoClaimPayload();
      if (storedClaim) {
        clearStoredDemoAccessToken();
        setClaimAccessToken("");
        setClaimState({ status: "ready", payload: storedClaim });
        setConversionState(() => {
          const storedConversion = readStoredDemoConversionPayload(storedClaim);
          return storedConversion
            ? { status: "result", payload: storedConversion }
            : { status: "idle" };
        });
        setClientRestoreComplete(true);
        return;
      }

      if (hadStoredClaim) {
        setClaimAccessToken("");
        setClaimState({ status: "error", message: t("dashboard.demo.error.expired") });
        setConversionState({ status: "idle" });
        setClientRestoreComplete(true);
        return;
      }

      const storedAccessToken = readStoredDemoAccessToken();
      if (storedAccessToken) {
        setClaimAccessToken(storedAccessToken);
        setClaimState({ status: "loading" });
        setConversionState({ status: "idle" });
        setClientRestoreComplete(true);
        return;
      }

      setClaimAccessToken("");
      setClaimState({ status: "idle" });
      setConversionState({ status: "idle" });
      setClientRestoreComplete(true);
    };
    const restoreFromHashChange = () => {
      queueMicrotask(() => {
        if (!canceled) {
          restoreLocationAccessToken();
        }
      });
    };

    queueMicrotask(() => {
      if (canceled) {
        return;
      }
      if (restoreLocationAccessToken()) {
        return;
      }
      if (claimAccessToken) {
        setClientRestoreComplete(true);
        return;
      }
      restoreStoredSession();
    });
    window.addEventListener("hashchange", restoreFromHashChange);
    return () => {
      canceled = true;
      window.removeEventListener("hashchange", restoreFromHashChange);
    };
  }, [claimAccessToken, trimmedToken, t]);

  const exchangeClaimToken = useCallback(
    async (isCanceled: () => boolean = () => false): Promise<ClaimState | null> => {
      if (!claimAccessToken) {
        return null;
      }
      try {
        const response = await fetch("/api/prospect-showcases/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: claimAccessToken }),
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        if (isCanceled()) {
          return null;
        }
        if (!response.ok) {
          clearStoredDemoClaimPayload();
          storeDemoAccessToken(claimAccessToken);
          return {
            status: "error",
            message: parseErrorMessage(body, t("dashboard.demo.error.claimUnavailable")),
          };
        }
        const parsed = parseClaimPayload(body);
        if (!parsed) {
          clearStoredDemoClaimPayload();
          return { status: "error", message: t("dashboard.demo.error.invalidClaim") };
        }
        storeDemoClaimPayload(parsed);
        clearStoredDemoAccessToken();
        return { status: "ready", payload: parsed };
      } catch {
        if (isCanceled()) {
          return null;
        }
        clearStoredDemoClaimPayload();
        storeDemoAccessToken(claimAccessToken);
        return { status: "error", message: t("dashboard.demo.error.openFailed") };
      }
    },
    [claimAccessToken, t],
  );

  async function handleRetryClaim() {
    setClaimState({ status: "loading" });
    setConversionState({ status: "idle" });
    const nextState = await exchangeClaimToken();
    if (nextState) {
      setClaimState(nextState);
      if (nextState.status === "ready") {
        const storedConversion = readStoredDemoConversionPayload(nextState.payload);
        setConversionState(
          storedConversion ? { status: "result", payload: storedConversion } : { status: "idle" },
        );
      }
    }
  }

  async function handleResendAccessLink() {
    const trimmedEmail = email.trim();
    if (!emailSchema.safeParse(trimmedEmail).success) {
      setEmailError(t("dashboard.demo.form.emailInvalid"));
      return;
    }
    setEmailError(null);
    setAccessLinkResendState({ status: "sending" });
    try {
      const response = await fetch("/api/prospect-showcases/access-link/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setAccessLinkResendState({
          status: "error",
          message: parseErrorMessage(body, t("dashboard.demo.resend.failed")),
        });
        return;
      }
      setAccessLinkResendState({
        status: "sent",
        message: t("dashboard.demo.resend.sent"),
      });
    } catch {
      setAccessLinkResendState({
        status: "error",
        message: t("dashboard.demo.resend.failed"),
      });
    }
  }

  useEffect(() => {
    if (!claimAccessToken) {
      return;
    }

    let canceled = false;
    void (async () => {
      const nextState = await exchangeClaimToken(() => canceled);
      if (!canceled && nextState) {
        setClaimState(nextState);
        if (nextState.status === "ready") {
          const storedConversion = readStoredDemoConversionPayload(nextState.payload);
          setConversionState(
            storedConversion ? { status: "result", payload: storedConversion } : { status: "idle" },
          );
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [claimAccessToken, exchangeClaimToken]);

  useEffect(() => {
    if (!payload) {
      return;
    }
    if (conversionState.status === "submitting") {
      return;
    }
    const expiresAtMs = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return;
    }
    const delayMs = Math.max(0, Math.min(expiresAtMs - Date.now(), 2_147_483_647));
    const timeout = window.setTimeout(() => {
      expireCurrentDemoClaim();
    }, delayMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [conversionState.status, expireCurrentDemoClaim, payload]);

  async function handleConvert() {
    if (!payload) {
      return;
    }
    const currentPayload = payload;
    if (!isFreshClaimPayload(currentPayload)) {
      expireCurrentDemoClaim();
      return;
    }
    const trimmedEmail = email.trim();
    if (!emailSchema.safeParse(trimmedEmail).success) {
      setEmailError(t("dashboard.demo.form.emailInvalid"));
      return;
    }
    setEmailError(null);
    setConversionState({ status: "submitting" });
    try {
      const response = await fetch(
        `/api/prospect-showcases/${encodeURIComponent(currentPayload.prospectShowcaseRef)}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            conversionToken: currentPayload.conversionToken,
            dashboardToken: currentPayload.token,
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
      storeDemoConversionPayload(currentPayload, parsed);
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
  const conversionAction =
    conversionState.status === "result" ? getConversionAction(t, conversionState.payload) : null;
  const conversionResultTone =
    conversionState.status === "result" && conversionState.payload.status === "payment_failed"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-primary/25 bg-primary/10 text-primary";
  const conversionIsTerminal =
    conversionState.status === "result" && conversionState.payload.status === "converted";
  const showConversionForm = conversionState.status !== "result" && !conversionIsTerminal;

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
            <CardContent className="grid gap-4">
              {claimAccessToken ? (
                <Button type="button" variant="outline" onClick={() => void handleRetryClaim()}>
                  {t("dashboard.demo.error.retry")}
                </Button>
              ) : null}
              <div className="grid gap-3 border-t border-border/70 pt-4">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium">{t("dashboard.demo.resend.emailLabel")}</span>
                  <Input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.currentTarget.value);
                      if (emailError) {
                        setEmailError(null);
                      }
                      if (accessLinkResendState.status === "error") {
                        setAccessLinkResendState({ status: "idle" });
                      }
                    }}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t("dashboard.demo.form.emailPlaceholder")}
                    disabled={accessLinkResendState.status === "sending"}
                  />
                </label>
                {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
                {accessLinkResendState.status === "sent" ||
                accessLinkResendState.status === "error" ? (
                  <p
                    className={
                      accessLinkResendState.status === "error"
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {accessLinkResendState.message}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleResendAccessLink()}
                  disabled={accessLinkResendState.status === "sending" || !email.trim()}
                >
                  {accessLinkResendState.status === "sending"
                    ? t("dashboard.demo.resend.submitting")
                    : t("dashboard.demo.resend.submit")}
                </Button>
              </div>
            </CardContent>
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
                    {conversionAction ? (
                      <Button asChild className="mt-3 w-full sm:w-auto">
                        <a href={conversionAction.href}>
                          <ArrowUpRight className="h-4 w-4" />
                          {conversionAction.label}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {showConversionForm ? (
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
                          if (accessLinkResendState.status === "error") {
                            setAccessLinkResendState({ status: "idle" });
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
