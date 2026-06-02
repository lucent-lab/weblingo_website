import type { NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
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

  const configResult = getPreviewProxyConfig("text");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidRefResponse = validateProspectShowcaseRef(ref, "text");
  if (invalidRefResponse) {
    return invalidRefResponse;
  }

  const tokenResult = readPreviewStatusToken(request, "text");
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-stream"),
    limit: config.streamMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "text",
    limitedMessage: "Too many stream requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase stream ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases/${encodeURIComponent(ref)}/stream`,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/event-stream",
          "x-preview-token": config.previewToken,
          "x-preview-status-token": tokenResult.statusToken,
        },
        cache: "no-store",
      },
      { timeoutMs: config.upstreamStreamConnectTimeoutMs, signal: request.signal },
    );
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "text");
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text || "Demo stream unavailable.", {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return new Response("Demo stream unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
