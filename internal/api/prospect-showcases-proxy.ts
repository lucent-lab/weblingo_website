import { NextResponse, type NextRequest } from "next/server";

import {
  readJsonBodyLimited,
  RequestBodyInvalidJsonError,
  RequestBodyTooLargeError,
} from "@internal/core/body";
import { buildErrorLogFields } from "@internal/core/error-log";
import { envServer } from "@internal/core/env-server";
import { FetchTimeoutError } from "@internal/core/fetch-timeout";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { redis } from "@internal/core/redis";
import { getClientIp } from "@internal/core/request-ip";

export type ProspectShowcaseProxyResponseKind = "json" | "text";

export type ProspectShowcaseProxyConfig = {
  apiBase: string;
  tryNowToken: string;
  rateLimitWindowMs: number;
  createMaxPerWindow: number;
  createMaxPerSourceHostPerWindow: number;
  statusMaxPerWindow: number;
  streamMaxPerWindow: number;
  maxBodyBytes: number;
  upstreamCreateTimeoutMs: number;
  upstreamStatusTimeoutMs: number;
  upstreamStreamConnectTimeoutMs: number;
};

type ProspectShowcaseProxyConfigResult =
  | { ok: true; config: ProspectShowcaseProxyConfig }
  | { ok: false; response: Response };

type ProspectShowcaseRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  responseKind: ProspectShowcaseProxyResponseKind;
  limitedMessage: string;
  backendFailureLogMessage: string;
};

type ProspectShowcaseBodyResult =
  | { ok: true; payload: unknown }
  | { ok: false; response: Response };

const UPSTREAM_RESPONSE_HEADERS_TO_COPY = [
  "Cache-Control",
  "Pragma",
  "Expires",
  "Retry-After",
] as const;

export function createProspectShowcaseProxyResponse(
  kind: ProspectShowcaseProxyResponseKind,
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  if (kind === "json") {
    return NextResponse.json({ error: message }, { status, headers });
  }
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain",
      ...headers,
    },
  });
}

export function buildProspectShowcaseUpstreamResponseHeaders(
  upstream: Response,
  fallbackContentType: string,
): Headers {
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? fallbackContentType);
  for (const headerName of UPSTREAM_RESPONSE_HEADERS_TO_COPY) {
    const value = upstream.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }
  return headers;
}

export function getProspectShowcaseProxyConfig(
  responseKind: ProspectShowcaseProxyResponseKind,
): ProspectShowcaseProxyConfigResult {
  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const tryNowToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !tryNowToken) {
    return {
      ok: false,
      response: createProspectShowcaseProxyResponse(
        responseKind,
        "Preview service is not configured.",
        500,
      ),
    };
  }

  return {
    ok: true,
    config: {
      apiBase,
      tryNowToken,
      rateLimitWindowMs: Number(envServer.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS),
      createMaxPerWindow: Number(envServer.WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW),
      createMaxPerSourceHostPerWindow: Number(
        envServer.WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW,
      ),
      statusMaxPerWindow: Number(envServer.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW),
      streamMaxPerWindow: Number(envServer.WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW),
      maxBodyBytes: Number(envServer.WEBSITE_PREVIEW_MAX_BODY_BYTES),
      upstreamCreateTimeoutMs: Number(envServer.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS),
      upstreamStatusTimeoutMs: Number(envServer.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS),
      upstreamStreamConnectTimeoutMs: Number(
        envServer.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS,
      ),
    },
  };
}

export function isProspectShowcaseRef(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,80}$/.test(value);
}

export function validateProspectShowcaseRef(
  ref: string,
  responseKind: ProspectShowcaseProxyResponseKind,
): Response | null {
  if (!ref || !isProspectShowcaseRef(ref)) {
    return createProspectShowcaseProxyResponse(
      responseKind,
      "Invalid prospect showcase reference",
      400,
    );
  }
  return null;
}

export function readProspectShowcaseStatusToken(
  request: NextRequest,
  responseKind: ProspectShowcaseProxyResponseKind,
): { ok: true; statusToken: string } | { ok: false; response: Response } {
  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return {
      ok: false,
      response: createProspectShowcaseProxyResponse(
        responseKind,
        "Missing preview status token",
        400,
      ),
    };
  }
  return { ok: true, statusToken };
}

export async function enforceProspectShowcaseRateLimit({
  key,
  limit,
  windowMs,
  responseKind,
  limitedMessage,
  backendFailureLogMessage,
}: ProspectShowcaseRateLimitOptions): Promise<Response | null> {
  try {
    const rateLimit = await rateLimitFixedWindow(redis, {
      key,
      limit,
      windowMs,
    });
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000));
      return createProspectShowcaseProxyResponse(responseKind, limitedMessage, 429, {
        "Retry-After": String(retryAfterSeconds),
      });
    }
    return null;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: backendFailureLogMessage,
          ...buildErrorLogFields(error),
        },
        null,
        0,
      ),
    );
    return createProspectShowcaseProxyResponse(
      responseKind,
      "Service temporarily unavailable. Please try again shortly.",
      503,
    );
  }
}

export function buildProspectShowcaseIpRateLimitKey(request: NextRequest, scope: string): string {
  return `rl:v1:preview:${scope}:ip:${encodeURIComponent(getClientIp(request))}`;
}

export function buildProspectShowcaseHostRateLimitKey(sourceHost: string): string {
  return `rl:v1:preview:create:host:${encodeURIComponent(sourceHost)}`;
}

export async function readProspectShowcaseJsonBodyLimited(
  request: NextRequest,
  maxBytes: number,
): Promise<ProspectShowcaseBodyResult> {
  try {
    return {
      ok: true,
      payload: await readJsonBodyLimited(request, { maxBytes }),
    };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
      };
    }
    if (error instanceof RequestBodyInvalidJsonError) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
    };
  }
}

export function createProspectShowcaseFetchErrorResponse(
  error: unknown,
  responseKind: ProspectShowcaseProxyResponseKind,
): Response {
  if (error instanceof FetchTimeoutError) {
    return createProspectShowcaseProxyResponse(responseKind, "Preview service timed out", 504);
  }
  return createProspectShowcaseProxyResponse(responseKind, "Unable to reach preview service.", 502);
}
