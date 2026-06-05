import { NextResponse, type NextRequest } from "next/server";

import {
  buildProspectShowcaseIpRateLimitKey,
  buildProspectShowcaseUpstreamResponseHeaders,
  createProspectShowcaseFetchErrorResponse,
  createProspectShowcaseProxyResponse,
  enforceProspectShowcaseRateLimit,
  getProspectShowcaseProxyConfig,
  readProspectShowcaseJsonBodyLimited,
} from "@internal/api/prospect-showcases-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";
import {
  buildDashboardDemoRedirectUrl,
  buildDashboardDemoSessionCookieOptions,
  createDashboardDemoSession,
  parseDashboardDemoClaimPayload,
} from "@internal/dashboard/demo-session";
import { DASHBOARD_DEMO_SESSION_COOKIE } from "@internal/dashboard/demo-session-constants";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  const configResult = getProspectShowcaseProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const bodyResult = await readProspectShowcaseJsonBodyLimited(request, 1_024);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createProspectShowcaseProxyResponse("json", "Invalid request body", 400);
  }
  const token = typeof bodyResult.payload.token === "string" ? bodyResult.payload.token.trim() : "";
  if (!token) {
    return createProspectShowcaseProxyResponse("json", "Missing demo access token", 400);
  }

  const rateLimitResponse = await enforceProspectShowcaseRateLimit({
    key: buildProspectShowcaseIpRateLimitKey(request, "prospect-claim"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many demo access requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase claim ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases/claim`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
      },
      { timeoutMs: config.upstreamCreateTimeoutMs, signal: request.signal },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      return new NextResponse(text || undefined, {
        status: upstream.status,
        headers: buildProspectShowcaseUpstreamResponseHeaders(upstream, "application/json"),
      });
    }

    const parsedBody = text ? safeParseJson(text) : null;
    const claim = parseDashboardDemoClaimPayload(parsedBody);
    if (!claim) {
      return createProspectShowcaseProxyResponse(
        "json",
        "Demo service returned an invalid dashboard claim.",
        502,
      );
    }
    if (isExpiredClaim(claim.expiresAt)) {
      return createProspectShowcaseProxyResponse(
        "json",
        "Demo dashboard access is no longer available.",
        401,
      );
    }

    let session;
    try {
      session = await createDashboardDemoSession(claim);
    } catch (error) {
      console.error("[prospect-showcases] dashboard demo session create failed:", error);
      return createProspectShowcaseProxyResponse(
        "json",
        "Demo dashboard access is temporarily unavailable.",
        503,
      );
    }

    const response = NextResponse.json(
      {
        demo: true,
        expiresAt: claim.expiresAt,
        prospectShowcaseRef: claim.prospectShowcaseRef,
        siteId: claim.siteId,
        redirectUrl: buildDashboardDemoRedirectUrl(claim.siteId),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
    response.cookies.set(
      DASHBOARD_DEMO_SESSION_COOKIE,
      session.id,
      buildDashboardDemoSessionCookieOptions(session.maxAgeSeconds),
    );
    return response;
  } catch (error) {
    return createProspectShowcaseFetchErrorResponse(error, "json");
  }
}

function safeParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isExpiredClaim(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}
