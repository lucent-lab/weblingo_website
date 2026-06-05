import { NextResponse, type NextRequest } from "next/server";

import {
  buildProspectShowcaseIpRateLimitKey,
  buildProspectShowcaseUpstreamResponseHeaders,
  createProspectShowcaseFetchErrorResponse,
  createProspectShowcaseProxyResponse,
  enforceProspectShowcaseRateLimit,
  getProspectShowcaseProxyConfig,
  readProspectShowcaseJsonBodyLimited,
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
  const configResult = getProspectShowcaseProxyConfig("json");
  if (!configResult.ok) {
    return configResult.response;
  }
  const { config } = configResult;

  const bodyResult = await readProspectShowcaseJsonBodyLimited(request, 1_024);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }
  if (!isRecord(bodyResult.payload)) {
    return createProspectShowcaseProxyResponse("json", "Invalid request body", 400);
  }
  const email = typeof bodyResult.payload.email === "string" ? bodyResult.payload.email.trim() : "";
  if (!email) {
    return createProspectShowcaseProxyResponse("json", "Missing email", 400);
  }
  if (!isValidEmail(email)) {
    return createProspectShowcaseProxyResponse("json", "Invalid email", 400);
  }

  const rateLimitResponse = await enforceProspectShowcaseRateLimit({
    key: buildProspectShowcaseIpRateLimitKey(request, "prospect-access-link-resend"),
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
          "x-preview-token": config.tryNowToken,
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
      headers: buildProspectShowcaseUpstreamResponseHeaders(upstream, "application/json"),
    });
  } catch (error) {
    return createProspectShowcaseFetchErrorResponse(error, "json");
  }
}
