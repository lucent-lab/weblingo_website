import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { fetchDeployments, fetchSite, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireDashboardAuth();
  if (!auth.webhooksAuth) {
    return NextResponse.json({ error: "Missing credentials." }, { status: 401 });
  }
  if (!auth.subjectAccountId) {
    return NextResponse.json({ error: "Missing account context." }, { status: 401 });
  }
  const token = auth.webhooksAuth;
  const { siteId } = await params;

  try {
    const site = await fetchSite(token, siteId);
    if (site.accountId !== auth.subjectAccountId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const deployments = await fetchDeployments(token, siteId);
    return NextResponse.json({ site, deployments });
  } catch (error) {
    if (error instanceof WebhooksApiError && error.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to load status" }, { status: 500 });
  }
}
