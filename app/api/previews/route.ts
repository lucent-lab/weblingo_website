import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.NEXT_PUBLIC_TRY_NOW_TOKEN;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!API_BASE || !PREVIEW_TOKEN) {
    return NextResponse.json(
      { error: "Preview service is not configured." },
      { status: 500 },
    );
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
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new NextResponse(text || undefined, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach preview service.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
