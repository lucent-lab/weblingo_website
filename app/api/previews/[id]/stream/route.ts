import { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.TRY_NOW_TOKEN;

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!API_BASE || !PREVIEW_TOKEN) {
    return new Response("Preview service is not configured.", { status: 500 });
  }

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return new Response("Invalid preview id", { status: 400 });
  }

  const statusToken = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!statusToken) {
    return new Response("Missing preview status token", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/previews/${encodeURIComponent(id)}/stream`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "x-preview-token": PREVIEW_TOKEN,
        "x-preview-status-token": statusToken,
      },
      cache: "no-store",
      signal: request.signal,
    });
  } catch (error) {
    console.warn("[preview] stream fetch failed", error);
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
  const passthrough = ["content-type"];
  upstream.headers.forEach((value, key) => {
    if (passthrough.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
