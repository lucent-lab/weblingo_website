import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewHostRateLimitKey,
  buildPreviewIpRateLimitKey,
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
  if (!isRecord(payload)) {
    return null;
  }
  const sourceUrl = payload.sourceUrl;
  if (typeof sourceUrl !== "string") {
    return null;
  }
  try {
    return new URL(sourceUrl).hostname.trim().toLowerCase() || null;
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
    key: buildPreviewIpRateLimitKey(request, "create"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many preview requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (preview create ip)",
  });
  if (ipLimitResponse) {
    return ipLimitResponse;
  }

  const bodyResult = await readPreviewJsonBodyLimited(request, config.maxBodyBytes);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  const { payload } = bodyResult;

  const sourceHost = tryExtractSourceHost(payload);
  if (sourceHost) {
    const hostLimitResponse = await enforcePreviewRateLimit({
      key: buildPreviewHostRateLimitKey(sourceHost),
      limit: config.createMaxPerSourceHostPerWindow,
      windowMs: config.rateLimitWindowMs,
      responseKind: "json",
      limitedMessage: "Too many preview requests for this site. Please try again shortly.",
      backendFailureLogMessage: "Rate limit backend failed (preview create host)",
    });
    if (hostLimitResponse) {
      return hostLimitResponse;
    }
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/previews`,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": config.previewToken,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      { timeoutMs: config.upstreamCreateTimeoutMs, signal: request.signal },
    );

    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const headers = new Headers();
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("X-Accel-Buffering", "no");
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": contentType || "application/json" },
    });
  } catch (error) {
    return createPreviewFetchErrorResponse(error, "json");
  }
}
