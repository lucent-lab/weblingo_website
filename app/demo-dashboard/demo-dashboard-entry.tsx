"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientTranslator, type ClientMessages } from "@internal/i18n/client";

type BridgeState =
  | { status: "loading" }
  | { status: "error"; message: string; retryToken: string | null };

type ClaimBridgeResponse = {
  demo: true;
  redirectUrl: string;
};

type AccessTokenInput = string | readonly string[] | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAccessToken(accessToken: AccessTokenInput): string {
  const value = Array.isArray(accessToken) ? accessToken[0] : accessToken;
  return typeof value === "string" ? value.trim() : "";
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

function parseClaimBridgeResponse(value: unknown): ClaimBridgeResponse | null {
  if (!isRecord(value) || value.demo !== true || typeof value.redirectUrl !== "string") {
    return null;
  }
  if (!value.redirectUrl.startsWith("/dashboard/sites/")) {
    return null;
  }
  return {
    demo: true,
    redirectUrl: value.redirectUrl,
  };
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
      }
      const serialized = hashParams.toString();
      nextHash = serialized ? `#${serialized}` : "";
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

export function DemoDashboardEntry({
  accessToken = "",
  messages,
  navigate,
}: {
  accessToken?: AccessTokenInput;
  messages: ClientMessages;
  navigate?: (href: string) => void;
}) {
  const searchParams = useSearchParams();
  const trimmedToken =
    normalizeAccessToken(accessToken) || normalizeAccessToken(searchParams.get("token"));
  return (
    <DemoDashboardBridge
      accessToken={trimmedToken}
      messages={messages}
      navigate={navigate ?? ((href) => window.location.assign(href))}
    />
  );
}

function DemoDashboardBridge({
  accessToken,
  messages,
  navigate,
}: {
  accessToken: string;
  messages: ClientMessages;
  navigate: (href: string) => void;
}) {
  const t = useMemo(() => createClientTranslator(messages), [messages]);
  const [state, setState] = useState<BridgeState>({ status: "loading" });

  const claimAndEnterDashboard = useCallback(
    async (rawToken: string, isCanceled: () => boolean = () => false) => {
      const token = rawToken.trim();
      if (!token) {
        setState({
          status: "error",
          message: t("dashboard.demo.error.missingToken"),
          retryToken: null,
        });
        return;
      }
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/prospect-showcases/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        if (isCanceled()) {
          return;
        }
        if (!response.ok) {
          setState({
            status: "error",
            message: parseErrorMessage(body, t("dashboard.demo.error.claimUnavailable")),
            retryToken: token,
          });
          return;
        }
        const parsed = parseClaimBridgeResponse(body);
        if (!parsed) {
          setState({
            status: "error",
            message: t("dashboard.demo.error.invalidClaim"),
            retryToken: token,
          });
          return;
        }
        navigate(parsed.redirectUrl);
      } catch {
        if (isCanceled()) {
          return;
        }
        setState({
          status: "error",
          message: t("dashboard.demo.error.openFailed"),
          retryToken: token,
        });
      }
    },
    [navigate, t],
  );

  useEffect(() => {
    let canceled = false;
    const token = accessToken || readDemoAccessTokenFromLocation();
    scrubDemoAccessTokenFromLocation();
    void Promise.resolve().then(() => {
      if (!canceled) {
        void claimAndEnterDashboard(token, () => canceled);
      }
    });
    return () => {
      canceled = true;
    };
  }, [accessToken, claimAndEnterDashboard]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{t("dashboard.demo.loading")}</span>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>{t("dashboard.demo.error.title")}</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          {state.retryToken ? (
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => void claimAndEnterDashboard(state.retryToken ?? "")}
              >
                {t("dashboard.demo.error.retry")}
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
