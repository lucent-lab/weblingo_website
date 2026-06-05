import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import { previewSourceSelection, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

type PaginationResult =
  | { ok: true; value: { limit?: number; offset?: number } }
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

function parsePagination(searchParams: URLSearchParams): PaginationResult {
  const out: { limit?: number; offset?: number } = {};

  const limit = parseOptionalInteger("limit", searchParams.get("limit"), { min: 1, max: 200 });
  if (!limit.ok) {
    return limit;
  }
  if (typeof limit.value === "number") {
    out.limit = limit.value;
  }

  const offset = parseOptionalInteger("offset", searchParams.get("offset"), { min: 0 });
  if (!offset.ok) {
    return offset;
  }
  if (typeof offset.value === "number") {
    out.offset = offset.value;
  }

  return { ok: true, value: out };
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireDashboardAuth();
  const { siteId } = await params;
  if (!isDashboardAuthScopedToSite(auth, siteId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!auth.webhooksAuth) {
    return NextResponse.json({ error: "Missing credentials." }, { status: 401 });
  }
  if (!auth.subjectAccountId) {
    return NextResponse.json({ error: "Missing account context." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    if (!pagination.ok) {
      return NextResponse.json({ error: pagination.error }, { status: 400 });
    }
    const preview = await previewSourceSelection(
      auth.webhooksAuth,
      siteId,
      body as {
        sourceSelection: {
          rules: Array<{ action: "include" | "exclude"; pattern: string }>;
        };
      },
      pagination.value,
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
