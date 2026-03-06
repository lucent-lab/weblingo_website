import { NextRequest, NextResponse } from "next/server";

import { envServer } from "@internal/core/env-server";
import { buildErrorLogFields } from "@internal/core/error-log";
import { redis } from "@internal/core/redis";
import { getClientIp } from "@internal/core/request-ip";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { fetchWithTimeout, FetchTimeoutError } from "@internal/core/fetch-timeout";
import {
  readJsonBodyLimited,
  RequestBodyTooLargeError,
  RequestBodyInvalidJsonError,
} from "@internal/core/body";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const previewToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !previewToken) {
    return NextResponse.json({ error: "Preview service is not configured." }, { status: 500 });
  }

  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  }

  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return NextResponse.json({ error: "Missing preview status token" }, { status: 400 });
  }

  try {
    const windowMs = Number(envServer.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS);
    const maxPerWindow = Number(envServer.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW);
    const upstreamTimeoutMs = Number(envServer.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS);

    const ip = getClientIp(request);
    try {
      const ipLimit = await rateLimitFixedWindow(redis, {
        key: `rl:v1:preview:status:ip:${encodeURIComponent(ip)}`,
        limit: maxPerWindow,
        windowMs,
      });
      if (!ipLimit.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAtMs - Date.now()) / 1000));
        return NextResponse.json(
          { error: "Too many status requests. Please try again shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfterSeconds),
            },
          },
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify(
          {
            level: "error",
            message: "Rate limit backend failed (preview status ip)",
            ...buildErrorLogFields(error),
          },
          null,
          0,
        ),
      );
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }

    const upstream = await fetchWithTimeout(
      `${apiBase}/previews/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          "x-preview-token": previewToken,
          "x-preview-status-token": statusToken,
        },
        cache: "no-store",
      },
      { timeoutMs: upstreamTimeoutMs, signal: request.signal },
    );

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return NextResponse.json({ error: "Preview service timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unable to reach preview service." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const previewToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !previewToken) {
    return NextResponse.json({ error: "Preview service is not configured." }, { status: 500 });
  }

  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  }

  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return NextResponse.json({ error: "Missing preview status token" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await readJsonBodyLimited(request, { maxBytes: 200 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    if (error instanceof RequestBodyInvalidJsonError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const windowMs = Number(envServer.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS);
  const maxPerWindow = Number(envServer.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW);
  const upstreamTimeoutMs = Number(envServer.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS);

  const ip = getClientIp(request);
  try {
    const ipLimit = await rateLimitFixedWindow(redis, {
      key: `rl:v1:preview:status:ip:${encodeURIComponent(ip)}`,
      limit: maxPerWindow,
      windowMs,
    });
    if (!ipLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAtMs - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Rate limit backend failed (preview update-email ip)",
          ...buildErrorLogFields(error),
        },
        null,
        0,
      ),
    );
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetchWithTimeout(
      `${apiBase}/previews/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": previewToken,
          "x-preview-status-token": statusToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      { timeoutMs: upstreamTimeoutMs, signal: request.signal },
    );

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return NextResponse.json({ error: "Preview service timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unable to reach preview service." }, { status: 502 });
  }
}
