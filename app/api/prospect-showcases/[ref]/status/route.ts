import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  buildPreviewUpstreamResponseHeaders,
  createPreviewFetchErrorResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewStatusToken,
  validateProspectShowcaseRef,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;

  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidRefResponse = validateProspectShowcaseRef(ref, "json");
  if (invalidRefResponse) {
    return invalidRefResponse;
  }

  const tokenResult = readPreviewStatusToken(request, "json");
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-status"),
    limit: config.statusMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many status requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase status ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases/${encodeURIComponent(ref)}/status`,
      {
        method: "GET",
        headers: {
          "x-preview-token": config.previewToken,
          "x-preview-status-token": tokenResult.statusToken,
        },
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
