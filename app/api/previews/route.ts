import { NextRequest, NextResponse } from "next/server";

import { envServer } from "@internal/core/env-server";
import { redis } from "@internal/core/redis";
import { getClientIp } from "@internal/core/request-ip";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import {
  readJsonBodyLimited,
  RequestBodyInvalidJsonError,
  RequestBodyTooLargeError,
} from "@internal/core/body";
import { fetchWithTimeout, FetchTimeoutError } from "@internal/core/fetch-timeout";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tryExtractSourceHost(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  const sourceUrl = payload.sourceUrl;
  if (typeof sourceUrl !== "string") {
    return null;
  }
  try {
    return new URL(sourceUrl).hostname.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiBase = envServer.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
  const previewToken = envServer.TRY_NOW_TOKEN;
  if (!apiBase || !previewToken) {
    return NextResponse.json({ error: "Preview service is not configured." }, { status: 500 });
  }

  const windowMs = Number(envServer.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS);
  const maxPerWindow = Number(envServer.WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW);
  const maxPerHostPerWindow = Number(
    envServer.WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW,
  );
  const maxBodyBytes = Number(envServer.WEBSITE_PREVIEW_MAX_BODY_BYTES);
  const upstreamTimeoutMs = Number(envServer.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS);

  const ip = getClientIp(request);
  try {
    const ipLimit = await rateLimitFixedWindow(redis, {
      key: `rl:v1:preview:create:ip:${encodeURIComponent(ip)}`,
      limit: maxPerWindow,
      windowMs,
    });
    if (!ipLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAtMs - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many preview requests. Please try again shortly." },
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
          message: "Rate limit backend failed (preview create ip)",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        0,
      ),
    );
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
  }

  let payload: unknown;
  try {
    payload = await readJsonBodyLimited(request, { maxBytes: maxBodyBytes });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    if (error instanceof RequestBodyInvalidJsonError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const sourceHost = tryExtractSourceHost(payload);
  if (sourceHost) {
    try {
      const hostLimit = await rateLimitFixedWindow(redis, {
        key: `rl:v1:preview:create:host:${encodeURIComponent(sourceHost)}`,
        limit: maxPerHostPerWindow,
        windowMs,
      });
      if (!hostLimit.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil((hostLimit.resetAtMs - Date.now()) / 1000));
        return NextResponse.json(
          { error: "Too many preview requests for this site. Please try again shortly." },
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
            message: "Rate limit backend failed (preview create host)",
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          0,
        ),
      );
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again shortly." },
          { status: 503 },
        );
      }
    }
  }

  try {
    const upstream = await fetchWithTimeout(
      `${apiBase}/previews`,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "x-preview-token": previewToken,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      { timeoutMs: upstreamTimeoutMs, signal: request.signal },
    );

    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const headers = new Headers();
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("X-Accel-Buffering", "no");
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": contentType || "application/json" },
    });
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return NextResponse.json({ error: "Preview service timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unable to reach preview service." }, { status: 502 });
  }
}
