import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  buildPreviewUpstreamResponseHeaders,
  createPreviewFetchErrorResponse,
  createPreviewProxyResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewJsonBodyLimited,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest) {
  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const bodyResult = await readPreviewJsonBodyLimited(request, 1_024);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createPreviewProxyResponse("json", "Invalid request body", 400);
  }
  const token = typeof bodyResult.payload.token === "string" ? bodyResult.payload.token.trim() : "";
  if (!token) {
    return createPreviewProxyResponse("json", "Missing demo access token", 400);
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-claim"),
    limit: config.statusMaxPerWindow,
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
      `${config.apiBase}/prospect-showcases/claim?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
      { timeoutMs: config.upstreamStatusTimeoutMs, signal: request.signal },
    );

    const text = await upstream.text();
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: buildPreviewUpstreamResponseHeaders(upstream, "application/json"),
    });
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "json");
  }
}
