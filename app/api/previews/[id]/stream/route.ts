import type { NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  createPreviewFetchErrorResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewStatusToken,
  validatePreviewId,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const configResult = getPreviewProxyConfig("text");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidIdResponse = validatePreviewId(id, "text");
  if (invalidIdResponse) {
    return invalidIdResponse;
  }

  const tokenResult = readPreviewStatusToken(request, "text");
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "stream"),
    limit: config.streamMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "text",
    limitedMessage: "Too many stream requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (preview stream ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      `${config.apiBase}/previews/${encodeURIComponent(id)}/stream`,
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
    return new Response(text || "Preview stream unavailable.", {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return new Response("Preview stream unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
