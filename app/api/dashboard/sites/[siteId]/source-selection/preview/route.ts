import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { previewSourceSelection, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

function parsePagination(searchParams: URLSearchParams): { limit?: number; offset?: number } {
  const out: { limit?: number; offset?: number } = {};
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");
  if (limitRaw !== null) {
    out.limit = Number(limitRaw);
  }
  if (offsetRaw !== null) {
    out.offset = Number(offsetRaw);
  }
  return out;
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireDashboardAuth();
  if (!auth.webhooksAuth) {
    return NextResponse.json({ error: "Missing credentials." }, { status: 401 });
  }
  if (!auth.subjectAccountId) {
    return NextResponse.json({ error: "Missing account context." }, { status: 401 });
  }

  const { siteId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const preview = await previewSourceSelection(
      auth.webhooksAuth,
      siteId,
      body as {
        sourceSelection: {
          rules: Array<{ action: "include" | "exclude"; pattern: string }>;
        };
      },
      parsePagination(url.searchParams),
    );
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof WebhooksApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status || 500 },
      );
    }
    console.warn("[dashboard] source-selection preview failed", {
      siteId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: "Unable to preview source selection." }, { status: 500 });
  }
}
