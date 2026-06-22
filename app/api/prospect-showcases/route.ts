import { NextResponse, type NextRequest } from "next/server";

import {
  buildProspectShowcaseHostRateLimitKey,
  buildProspectShowcaseIpRateLimitKey,
  buildProspectShowcaseUpstreamResponseHeaders,
  createProspectShowcaseProxyResponse,
  createProspectShowcaseFetchErrorResponse,
  enforceProspectShowcaseRateLimit,
  getProspectShowcaseProxyConfig,
  readProspectShowcaseJsonBodyLimited,
} from "@internal/api/prospect-showcases-proxy";
import { envServer } from "@internal/core/env-server";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";
import { getClientIp } from "@internal/core/request-ip";
import { hasUnresolvedRoutePlaceholder } from "@internal/core/route-placeholders";
import { evaluateTurnstile, TURNSTILE_FAIL_CLOSED } from "@internal/core/turnstile";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tryExtractSourceHost(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.sourceUrl !== "string") {
    return null;
  }
  try {
    return new URL(payload.sourceUrl).hostname.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const configResult = getProspectShowcaseProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const ipLimitResponse = await enforceProspectShowcaseRateLimit({
    key: buildProspectShowcaseIpRateLimitKey(request, "prospect-create"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many demo requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase create ip)",
  });
  if (ipLimitResponse) {
    return ipLimitResponse;
  }

  const bodyResult = await readProspectShowcaseJsonBodyLimited(request, config.maxBodyBytes);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const sourceHost = tryExtractSourceHost(bodyResult.payload);
  if (isRecord(bodyResult.payload) && typeof bodyResult.payload.sourceUrl === "string") {
    try {
      if (sourceUrlRoutePartsHaveUnresolvedPlaceholder(new URL(bodyResult.payload.sourceUrl))) {
        return createProspectShowcaseProxyResponse(
          "json",
          "Source URL must not contain unresolved route placeholders.",
          400,
        );
      }
    } catch {
      return createProspectShowcaseProxyResponse("json", "Source URL must be a valid URL.", 400);
    }
  }
  if (sourceHost) {
    const hostLimitResponse = await enforceProspectShowcaseRateLimit({
      key: buildProspectShowcaseHostRateLimitKey(sourceHost),
      limit: config.createMaxPerSourceHostPerWindow,
      windowMs: config.rateLimitWindowMs,
      responseKind: "json",
      limitedMessage: "Too many demo requests for this site. Please try again shortly.",
      backendFailureLogMessage: "Rate limit backend failed (prospect showcase create host)",
    });
    if (hostLimitResponse) {
      return hostLimitResponse;
    }
  }

  // Bot gating (M12.3): fail-closed — a Cloudflare outage blocks the request so
  // automated traffic cannot run up crawl + LLM translation spend.
  const turnstile = await evaluateTurnstile({
    secretKey: envServer.TURNSTILE_SECRET_KEY,
    token:
      isRecord(bodyResult.payload) && typeof bodyResult.payload.turnstileToken === "string"
        ? bodyResult.payload.turnstileToken
        : null,
    remoteIp: getClientIp(request),
    failClosed: TURNSTILE_FAIL_CLOSED.preview,
  });
  if (!turnstile.allowed) {
    return createProspectShowcaseProxyResponse(
      "json",
      "Verification failed. Please refresh and try again.",
      turnstile.status,
    );
  }

  // Never forward the Turnstile token upstream; it is consumed at this edge.
  const forwardPayload = isRecord(bodyResult.payload)
    ? Object.fromEntries(
        Object.entries(bodyResult.payload).filter(([key]) => key !== "turnstileToken"),
      )
    : bodyResult.payload;

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases`,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": config.tryNowToken,
          Accept: "application/json",
        },
        body: JSON.stringify(forwardPayload),
        cache: "no-store",
      },
      { timeoutMs: config.upstreamCreateTimeoutMs, signal: request.signal },
    );

    const text = await upstream.text();
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: buildProspectShowcaseUpstreamResponseHeaders(upstream, "application/json"),
    });
  } catch (error) {
    return createProspectShowcaseFetchErrorResponse(error, "json");
  }
}

function sourceUrlRoutePartsHaveUnresolvedPlaceholder(url: URL): boolean {
  return hasUnresolvedRoutePlaceholder(`${url.hostname}${url.pathname}`);
}
