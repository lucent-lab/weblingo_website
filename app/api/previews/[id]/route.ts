import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  createPreviewFetchErrorResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewJsonBodyLimited,
  readPreviewStatusToken,
  validatePreviewId,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidIdResponse = validatePreviewId(id, "json");
  if (invalidIdResponse) {
    return invalidIdResponse;
  }

  const tokenResult = readPreviewStatusToken(request, "json");
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "status"),
    limit: config.statusMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many status requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (preview status ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/previews/${encodeURIComponent(id)}`,
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
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "json");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const configResult = getPreviewProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidIdResponse = validatePreviewId(id, "json");
  if (invalidIdResponse) {
    return invalidIdResponse;
  }

  const tokenResult = readPreviewStatusToken(request, "json");
  if (!tokenResult.ok) {
    return tokenResult.response;
  }

  const bodyResult = await readPreviewJsonBodyLimited(request, 200);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "status"),
    limit: config.statusMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (preview update-email ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/previews/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": config.previewToken,
          "x-preview-status-token": tokenResult.statusToken,
        },
        body: JSON.stringify(bodyResult.payload),
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
