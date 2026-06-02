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

export type PreviewProxyResponseKind = "json" | "text";

export type PreviewProxyConfig = {
  apiBase: string;
  previewToken: string;
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

type PreviewProxyConfigResult =
  | { ok: true; config: PreviewProxyConfig }
  | { ok: false; response: Response };

type PreviewRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  responseKind: PreviewProxyResponseKind;
  limitedMessage: string;
  backendFailureLogMessage: string;
};

type PreviewBodyResult = { ok: true; payload: unknown } | { ok: false; response: Response };

const UPSTREAM_RESPONSE_HEADERS_TO_COPY = [
  "Cache-Control",
  "Pragma",
  "Expires",
  "Retry-After",
] as const;

export function createPreviewProxyResponse(
  kind: PreviewProxyResponseKind,
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

export function buildPreviewUpstreamResponseHeaders(
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

export function getPreviewProxyConfig(
  responseKind: PreviewProxyResponseKind,
): PreviewProxyConfigResult {
  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const previewToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !previewToken) {
    return {
      ok: false,
      response: createPreviewProxyResponse(responseKind, "Preview service is not configured.", 500),
    };
  }

  return {
    ok: true,
    config: {
      apiBase,
      previewToken,
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

export function isPreviewUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isProspectShowcaseRef(value: string): boolean {
  return /^[A-Za-z0-9_-]{10,80}$/.test(value);
}

export function validatePreviewId(
  id: string,
  responseKind: PreviewProxyResponseKind,
): Response | null {
  if (!id || !isPreviewUuid(id)) {
    return createPreviewProxyResponse(responseKind, "Invalid preview id", 400);
  }
  return null;
}

export function validateProspectShowcaseRef(
  ref: string,
  responseKind: PreviewProxyResponseKind,
): Response | null {
  if (!ref || !isProspectShowcaseRef(ref)) {
    return createPreviewProxyResponse(responseKind, "Invalid prospect showcase reference", 400);
  }
  return null;
}

export function readPreviewStatusToken(
  request: NextRequest,
  responseKind: PreviewProxyResponseKind,
): { ok: true; statusToken: string } | { ok: false; response: Response } {
  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return {
      ok: false,
      response: createPreviewProxyResponse(responseKind, "Missing preview status token", 400),
    };
  }
  return { ok: true, statusToken };
}

export async function enforcePreviewRateLimit({
  key,
  limit,
  windowMs,
  responseKind,
  limitedMessage,
  backendFailureLogMessage,
}: PreviewRateLimitOptions): Promise<Response | null> {
  try {
    const rateLimit = await rateLimitFixedWindow(redis, {
      key,
      limit,
      windowMs,
    });
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000));
      return createPreviewProxyResponse(responseKind, limitedMessage, 429, {
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
    return createPreviewProxyResponse(
      responseKind,
      "Service temporarily unavailable. Please try again shortly.",
      503,
    );
  }
}

export function buildPreviewIpRateLimitKey(request: NextRequest, scope: string): string {
  return `rl:v1:preview:${scope}:ip:${encodeURIComponent(getClientIp(request))}`;
}

export function buildPreviewHostRateLimitKey(sourceHost: string): string {
  return `rl:v1:preview:create:host:${encodeURIComponent(sourceHost)}`;
}

export async function readPreviewJsonBodyLimited(
  request: NextRequest,
  maxBytes: number,
): Promise<PreviewBodyResult> {
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

export function createPreviewFetchErrorResponse(
  error: unknown,
  responseKind: PreviewProxyResponseKind,
): Response {
  if (error instanceof FetchTimeoutError) {
    return createPreviewProxyResponse(responseKind, "Preview service timed out", 504);
  }
  return createPreviewProxyResponse(responseKind, "Unable to reach preview service.", 502);
}
