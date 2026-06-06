import { type NextRequest } from "next/server";

import { env } from "@internal/core";
import { fetchWithTimeout } from "@internal/core/fetch-timeout";

import {
  buildPosthogProxyRequestHeaders,
  buildPosthogProxyResponseHeaders,
  buildPosthogUpstreamUrl,
  shouldForwardRequestBody,
} from "./proxy";

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
    return posthogProxyFailureResponse(surfaceFailure, 504);
  }

  if (!upstreamResponse.ok) {
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
