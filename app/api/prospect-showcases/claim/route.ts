import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  createPreviewFetchErrorResponse,
  createPreviewProxyResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
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
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "json");
  }
}
