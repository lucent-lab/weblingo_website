import { NextResponse, type NextRequest } from "next/server";

import {
  buildProspectShowcaseIpRateLimitKey,
  buildProspectShowcaseUpstreamResponseHeaders,
  createProspectShowcaseFetchErrorResponse,
  createProspectShowcaseProxyResponse,
  enforceProspectShowcaseRateLimit,
  getProspectShowcaseProxyConfig,
  readProspectShowcaseJsonBodyLimited,
  validateProspectShowcaseRef,
} from "@internal/api/prospect-showcases-proxy";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;

  const configResult = getProspectShowcaseProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const invalidRefResponse = validateProspectShowcaseRef(ref, "json");
  if (invalidRefResponse) {
    return invalidRefResponse;
  }

  const bodyResult = await readProspectShowcaseJsonBodyLimited(request, 2_048);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createProspectShowcaseProxyResponse("json", "Invalid request body", 400);
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
    return createProspectShowcaseProxyResponse("json", "Missing conversion fields", 400);
  }

  const rateLimitResponse = await enforceProspectShowcaseRateLimit({
    key: buildProspectShowcaseIpRateLimitKey(request, "prospect-convert"),
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
      headers: buildProspectShowcaseUpstreamResponseHeaders(upstream, "application/json"),
    });
  } catch (error) {
    return createProspectShowcaseFetchErrorResponse(error, "json");
  }
}
