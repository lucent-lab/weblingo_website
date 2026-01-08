import { NextResponse } from "next/server";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { fetchDeployments, fetchSite, WebhooksApiError } from "@internal/dashboard/webhooks";

type RouteParams = {
  params: {
    siteId: string;
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireDashboardAuth();
  const token = auth.webhooksAuth!;

  try {
    const [site, deployments] = await Promise.all([
      fetchSite(token, params.siteId),
      fetchDeployments(token, params.siteId),
    ]);
    return NextResponse.json({ site, deployments });
  } catch (error) {
    if (error instanceof WebhooksApiError && error.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to load status" }, { status: 500 });
  }
}
