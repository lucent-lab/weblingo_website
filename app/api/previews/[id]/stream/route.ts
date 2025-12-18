import { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.NEXT_PUBLIC_TRY_NOW_TOKEN;

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!API_BASE || !PREVIEW_TOKEN) {
    return new Response("Preview service is not configured.", { status: 500 });
  }

  const upstream = await fetch(`${API_BASE}/previews/${encodeURIComponent(id)}/stream`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "x-preview-token": PREVIEW_TOKEN,
    },
    cache: "no-store",
    signal: _request.signal,
  });

  const headers = new Headers();
  const passthrough = ["content-type", "cache-control", "transfer-encoding"];
  upstream.headers.forEach((value, key) => {
    if (passthrough.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Connection", "keep-alive");
  headers.set("Cache-Control", "no-cache");
  headers.set("X-Accel-Buffering", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
