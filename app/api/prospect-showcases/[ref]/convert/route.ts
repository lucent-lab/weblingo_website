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

function readBearerAuthorization(request: NextRequest): string {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization : "";
}

function buildBodyBearerAuthorization(body: Record<string, unknown>): string {
  const dashboardToken = typeof body.dashboardToken === "string" ? body.dashboardToken.trim() : "";
  return dashboardToken ? `Bearer ${dashboardToken}` : "";
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

  const bodyResult = await readProspectShowcaseJsonBodyLimited(request, config.maxBodyBytes);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createProspectShowcaseProxyResponse("json", "Invalid request body", 400);
  }
  const email = typeof bodyResult.payload.email === "string" ? bodyResult.payload.email.trim() : "";
  const conversionToken =
    typeof bodyResult.payload.conversionToken === "string"
      ? bodyResult.payload.conversionToken.trim()
      : "";
  const authorization =
    readBearerAuthorization(request) || buildBodyBearerAuthorization(bodyResult.payload);
  if (!authorization) {
    return createProspectShowcaseProxyResponse("json", "Missing Authorization header", 401);
  }
  if (!email) {
    return createProspectShowcaseProxyResponse("json", "Missing email", 400);
  }
  if (!conversionToken) {
    return createProspectShowcaseProxyResponse("json", "Missing conversion token", 400);
  }

  const rateLimitResponse = await enforceProspectShowcaseRateLimit({
    key: buildProspectShowcaseIpRateLimitKey(request, "prospect-convert"),
    limit: config.createMaxPerWindow,
    windowMs: config.rateLimitWindowMs,
    responseKind: "json",
    limitedMessage: "Too many demo activation requests. Please try again shortly.",
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
          Authorization: authorization,
          "Content-Type": "application/json",
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
