import { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE?.replace(/\/$/, "");
const PREVIEW_TOKEN = process.env.NEXT_PUBLIC_TRY_NOW_TOKEN;

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!API_BASE || !PREVIEW_TOKEN) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "Preview service is not configured." })}\n\n`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "Invalid preview id" })}\n\n`,
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  try {
    const upstreamUrl = `${API_BASE}/previews/${id}/stream`;
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "x-preview-token": PREVIEW_TOKEN,
        Accept: "text/event-stream",
      },
    });

    if (!upstream.ok) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: `Upstream error: ${upstream.status}` })}\n\n`,
        {
          status: upstream.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      );
    }

    // Stream the upstream response directly
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach preview service.";
    return new Response(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`, {
      status: 502,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}

