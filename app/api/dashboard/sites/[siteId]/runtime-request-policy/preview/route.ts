import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import { previewRuntimeRequestPolicy, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

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
    const preview = await previewRuntimeRequestPolicy(
      auth.webhooksAuth,
      siteId,
      body as Parameters<typeof previewRuntimeRequestPolicy>[2],
    );
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof WebhooksApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status || 500 },
      );
    }
    console.warn("[dashboard] runtime-request-policy preview failed", {
      siteId,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: "Unable to preview runtime request policy." },
      { status: 500 },
    );
  }
}
