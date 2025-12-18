import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.NEXT_PUBLIC_TRY_NOW_TOKEN;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!API_BASE || !PREVIEW_TOKEN) {
    return NextResponse.json({ error: "Preview service is not configured." }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/previews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-preview-token": PREVIEW_TOKEN,
        Accept: request.headers.get("accept") ?? "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: request.signal,
    });

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
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType || "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach preview service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
