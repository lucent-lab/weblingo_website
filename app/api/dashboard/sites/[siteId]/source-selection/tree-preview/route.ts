import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { previewSourceSelectionTree, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

type TreePreviewQueryResult =
  | {
      ok: true;
      value: { limit?: number; cursor?: string; parentPath?: string; search?: string };
    }
  | { ok: false; error: string };

function parseOptionalInteger(
  name: string,
  rawValue: string | null,
  bounds: { min: number; max?: number },
): { ok: true; value?: number } | { ok: false; error: string } {
  if (rawValue === null) {
    return { ok: true };
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    return { ok: false, error: `${name} must be an integer.` };
  }
  if (value < bounds.min) {
    return { ok: false, error: `${name} must be at least ${bounds.min}.` };
  }
  if (typeof bounds.max === "number" && value > bounds.max) {
    return { ok: false, error: `${name} must be at most ${bounds.max}.` };
  }
  return { ok: true, value };
}

function parseTreePreviewQuery(searchParams: URLSearchParams): TreePreviewQueryResult {
  const out: { limit?: number; cursor?: string; parentPath?: string; search?: string } = {};

  const limit = parseOptionalInteger("limit", searchParams.get("limit"), { min: 1, max: 200 });
  if (!limit.ok) {
    return limit;
  }
  if (typeof limit.value === "number") {
    out.limit = limit.value;
  }

  const cursor = searchParams.get("cursor")?.trim();
  if (cursor) {
    out.cursor = cursor;
  }

  const search = searchParams.get("search")?.trim();
  if (search) {
    if (search.length > 200) {
      return { ok: false, error: "search must be at most 200 characters." };
    }
    out.search = search;
    return { ok: true, value: out };
  }

  const parentPath = searchParams.get("parentPath")?.trim();
  if (parentPath) {
    if (!parentPath.startsWith("/")) {
      return { ok: false, error: "parentPath must start with /." };
    }
    out.parentPath = parentPath;
  }

  return { ok: true, value: out };
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
    const query = parseTreePreviewQuery(url.searchParams);
    if (!query.ok) {
      return NextResponse.json({ error: query.error }, { status: 400 });
    }
    const preview = await previewSourceSelectionTree(
      auth.webhooksAuth,
      siteId,
      body as {
        sourceSelection: {
          rules: Array<{ action: "include" | "exclude"; pattern: string }>;
        };
      },
      query.value,
    );
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof WebhooksApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status || 500 },
      );
    }
    console.warn("[dashboard] source-selection tree preview failed", {
      siteId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: "Unable to preview source selection." }, { status: 500 });
  }
}
