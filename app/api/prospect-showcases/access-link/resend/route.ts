import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  buildPreviewUpstreamResponseHeaders,
  createPreviewFetchErrorResponse,
  createPreviewProxyResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewJsonBodyLimited,
} from "@internal/api/prospect-showcases-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  const email = typeof bodyResult.payload.email === "string" ? bodyResult.payload.email.trim() : "";
  if (!email) {
    return createPreviewProxyResponse("json", "Missing email", 400);
  }
  if (!isValidEmail(email)) {
    return createPreviewProxyResponse("json", "Invalid email", 400);
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-access-link-resend"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many access link requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase access link resend ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases/access-link/resend`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": config.previewToken,
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
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
