import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.NEXT_PUBLIC_TRY_NOW_TOKEN;

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!API_BASE || !PREVIEW_TOKEN) {
    return NextResponse.json(
      { error: "Preview service is not configured." },
      { status: 500 },
    );
  }

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/previews/${id}`, {
      method: "GET",
      headers: {
        "x-preview-token": PREVIEW_TOKEN,
      },
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

