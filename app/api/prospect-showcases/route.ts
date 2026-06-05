import { NextResponse, type NextRequest } from "next/server";

import {
  buildProspectShowcaseHostRateLimitKey,
  buildProspectShowcaseIpRateLimitKey,
  buildProspectShowcaseUpstreamResponseHeaders,
  createProspectShowcaseFetchErrorResponse,
  enforceProspectShowcaseRateLimit,
  getProspectShowcaseProxyConfig,
  readProspectShowcaseJsonBodyLimited,
} from "@internal/api/prospect-showcases-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

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
        body: JSON.stringify(bodyResult.payload),
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
