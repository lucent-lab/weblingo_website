import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewHostRateLimitKey,
  buildPreviewIpRateLimitKey,
  buildPreviewUpstreamResponseHeaders,
  createPreviewFetchErrorResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewJsonBodyLimited,
} from "@internal/api/previews-proxy";
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
  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const ipLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-create"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many demo requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase create ip)",
  });
  if (ipLimitResponse) {
    return ipLimitResponse;
  }

  const bodyResult = await readPreviewJsonBodyLimited(request, config.maxBodyBytes);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const sourceHost = tryExtractSourceHost(bodyResult.payload);
  if (sourceHost) {
    const hostLimitResponse = await enforcePreviewRateLimit({
      key: buildPreviewHostRateLimitKey(sourceHost),
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
          "x-preview-token": config.previewToken,
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
      headers: buildPreviewUpstreamResponseHeaders(upstream, "application/json"),
    });
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "json");
  }
}
