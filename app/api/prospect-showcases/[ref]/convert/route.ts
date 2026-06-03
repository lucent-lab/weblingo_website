import { NextResponse, type NextRequest } from "next/server";

import {
  buildPreviewIpRateLimitKey,
  buildPreviewUpstreamResponseHeaders,
  createPreviewFetchErrorResponse,
  createPreviewProxyResponse,
  enforcePreviewRateLimit,
  getPreviewProxyConfig,
  readPreviewJsonBodyLimited,
  validateProspectShowcaseRef,
} from "@internal/api/previews-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
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

  const bodyResult = await readPreviewJsonBodyLimited(request, 2_048);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createPreviewProxyResponse("json", "Invalid request body", 400);
  }
  const dashboardToken =
    typeof bodyResult.payload.dashboardToken === "string"
      ? bodyResult.payload.dashboardToken.trim()
      : "";
  const conversionToken =
    typeof bodyResult.payload.conversionToken === "string"
      ? bodyResult.payload.conversionToken.trim()
      : "";
  const email = typeof bodyResult.payload.email === "string" ? bodyResult.payload.email.trim() : "";
  if (!dashboardToken || !conversionToken || !email) {
    return createPreviewProxyResponse("json", "Missing conversion fields", 400);
  }

  const rateLimitResponse = await enforcePreviewRateLimit({
    key: buildPreviewIpRateLimitKey(request, "prospect-convert"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many conversion requests. Please try again shortly.",
    backendFailureLogMessage: "Rate limit backend failed (prospect showcase convert ip)",
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const upstream = await fetchWithTimeout(
      `${config.apiBase}/prospect-showcases/${encodeURIComponent(ref)}/convert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dashboardToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ email, conversionToken }),
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
