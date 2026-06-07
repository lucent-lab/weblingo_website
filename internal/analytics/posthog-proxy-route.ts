import { type NextRequest } from "next/server";

import { env } from "@internal/core";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

import { ANALYTICS_EVENTS } from "./events";
import {
  buildPosthogProxyRequestHeaders,
  buildPosthogProxyResponseHeaders,
  buildPosthogUpstreamUrl,
  shouldForwardRequestBody,
} from "./proxy";
import { captureServerAnalyticsEvent } from "./server";

const POSTHOG_PROXY_TIMEOUT_MS = 5_000;

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function shouldSurfaceProxyFailure(method: string, path: string[]): boolean {
  const normalizedMethod = method.trim().toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") {
    return false;
  }
  const lastSegment = path.at(-1) ?? "";
  return path[0] === "static" || lastSegment.endsWith(".js");
}

function posthogProxyFailureResponse(surfaceFailure: boolean, status = 502): Response {
  return new Response(null, {
    headers: {
      "cache-control": "no-store",
    },
    status: surfaceFailure ? status : 204,
  });
}

function classifyPosthogProxyPath(path: string[]): string {
  const firstSegment = path[0] ?? "";
  const lastSegment = path.at(-1) ?? "";
  if (firstSegment === "static" || lastSegment.endsWith(".js")) {
    return "static_asset";
  }
  if (firstSegment === "batch" || firstSegment === "decide" || firstSegment === "e") {
    return "ingestion";
  }
  return path.length > 0 ? "other" : "root";
}

function normalizeRequestMethod(method: string): string {
  const normalized = method.trim().toUpperCase();
  return normalized || "UNKNOWN";
}

function resolvePosthogProxyRouteTemplate(requestUrl: string): string {
  const pathname = new URL(requestUrl).pathname;
  return pathname.startsWith("/api/analytics/posthog")
    ? "/api/analytics/posthog/[[...path]]"
    : "/_analytics/posthog/[[...path]]";
}

function capturePosthogProxyFailure(options: {
  failureKind: string;
  path: string[];
  request: NextRequest;
  statusCode: number;
  surfaceFailure: boolean;
}): void {
  captureServerAnalyticsEvent(ANALYTICS_EVENTS.analyticsProxyFailed, {
    failure_kind: options.failureKind,
    request_method: normalizeRequestMethod(options.request.method),
    route_area: "api",
    route_template: resolvePosthogProxyRouteTemplate(options.request.url),
    source: "posthog_proxy",
    status: options.surfaceFailure ? "surfaced" : "degraded",
    status_code: options.statusCode,
    target_kind: classifyPosthogProxyPath(options.path),
  });
}

async function proxyPosthogRequest(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  const surfaceFailure = shouldSurfaceProxyFailure(request.method, path);
  const upstreamUrl = buildPosthogUpstreamUrl(env.NEXT_PUBLIC_POSTHOG_HOST, path, request.url);
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchWithTimeout(
      upstreamUrl,
      {
        body: shouldForwardRequestBody(request.method) ? await request.arrayBuffer() : undefined,
        headers: buildPosthogProxyRequestHeaders(request.headers, request.url),
        method: request.method,
        redirect: "manual",
      },
      { timeoutMs: POSTHOG_PROXY_TIMEOUT_MS },
    );
  } catch {
    capturePosthogProxyFailure({
      failureKind: "upstream_fetch",
      path,
      request,
      statusCode: 504,
      surfaceFailure,
    });
    return posthogProxyFailureResponse(surfaceFailure, 504);
  }

  if (!upstreamResponse.ok) {
    capturePosthogProxyFailure({
      failureKind: "upstream_status",
      path,
      request,
      statusCode: upstreamResponse.status,
      surfaceFailure,
    });
    return posthogProxyFailureResponse(surfaceFailure, upstreamResponse.status);
  }

  return new Response(upstreamResponse.body, {
    headers: buildPosthogProxyResponseHeaders(upstreamResponse.headers),
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}

export const GET = proxyPosthogRequest;
export const HEAD = proxyPosthogRequest;
export const OPTIONS = proxyPosthogRequest;
export const POST = proxyPosthogRequest;
