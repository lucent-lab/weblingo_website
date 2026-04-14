import { type NextRequest } from "next/server";

import { env } from "@internal/core";
import {
  buildPosthogProxyRequestHeaders,
  buildPosthogProxyResponseHeaders,
  buildPosthogUpstreamUrl,
  shouldForwardRequestBody,
} from "@internal/analytics/proxy";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxyPosthogRequest(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  const upstreamUrl = buildPosthogUpstreamUrl(env.NEXT_PUBLIC_POSTHOG_HOST, path, request.url);
  const upstreamResponse = await fetch(upstreamUrl, {
    body: shouldForwardRequestBody(request.method) ? await request.arrayBuffer() : undefined,
    headers: buildPosthogProxyRequestHeaders(request.headers, request.url),
    method: request.method,
    redirect: "manual",
  });

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
