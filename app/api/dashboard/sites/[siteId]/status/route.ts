import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import { fetchSiteCompactStatus, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
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
  const token = auth.webhooksAuth;

  try {
    const status = await fetchSiteCompactStatus(token, siteId);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof WebhooksApiError && error.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to load status" }, { status: 500 });
  }
}
