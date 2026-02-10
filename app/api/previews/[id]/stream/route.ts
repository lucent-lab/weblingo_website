import { NextRequest } from "next/server";

import { envServer } from "@internal/core/env-server";
import { redis } from "@internal/core/redis";
import { getClientIp } from "@internal/core/request-ip";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { fetchWithTimeout, FetchTimeoutError } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const previewToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !previewToken) {
    return new Response("Preview service is not configured.", { status: 500 });
  }

  if (!id || !isUuid(id)) {
    return new Response("Invalid preview id", { status: 400 });
  }

  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return new Response("Missing preview status token", { status: 400 });
  }

  const windowMs = Number(envServer.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS);
  const maxPerWindow = Number(envServer.WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW);
  const upstreamConnectTimeoutMs = Number(
    envServer.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS,
  );

  const ip = getClientIp(request);
  const ipLimit = await rateLimitFixedWindow(redis, {
    key: `rl:v1:preview:stream:ip:${encodeURIComponent(ip)}`,
    limit: maxPerWindow,
    windowMs,
  });
  if (!ipLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAtMs - Date.now()) / 1000));
    return new Response("Too many stream requests. Please try again shortly.", {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Content-Type": "text/plain",
      },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      `${apiBase}/previews/${encodeURIComponent(id)}/stream`,
      {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/event-stream",
          "x-preview-token": previewToken,
          "x-preview-status-token": statusToken,
        },
        cache: "no-store",
      },
      { timeoutMs: upstreamConnectTimeoutMs, signal: request.signal },
    );
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return new Response("Preview service timed out", {
        status: 504,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Unable to reach preview service.", { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text || "Preview stream unavailable.", {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return new Response("Preview stream unavailable.", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
