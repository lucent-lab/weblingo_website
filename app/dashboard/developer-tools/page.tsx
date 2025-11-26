import { env } from "@internal/core";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getWebhooksToken } from "../_lib/webhooks-token";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Developer tools",
  robots: { index: false, follow: false },
};

export default async function DeveloperToolsPage() {
  const { token, expiresAt } = await getWebhooksToken();
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const formattedSessionExpiry = formatEpoch(session?.expires_at);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Developer tools</h2>
        <p className="text-sm text-muted-foreground">
          Bridges Supabase auth to the webhooks worker and shows the base API configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API base</CardTitle>
          <CardDescription>All dashboard calls go through the worker endpoints.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            NEXT_PUBLIC_WEBHOOKS_API_BASE
          </label>
          <Input readOnly value={env.NEXT_PUBLIC_WEBHOOKS_API_BASE} />
          <p className="text-xs text-muted-foreground">
            Ensure CORS is enabled for your dashboard origin. All endpoints are documented in{" "}
            <code className="rounded bg-muted px-1 py-0.5">docs/DASHBOARD_SPECS.md</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Webhooks JWT</CardTitle>
            <CardDescription>
              Short-lived token derived from your Supabase session. Renew on or before expiry.
            </CardDescription>
          </div>
          <Badge variant="outline">Expires at {expiresAt}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Authorization header
          </label>
          <Input readOnly value={`Bearer ${token}`} />
          <p className="text-xs text-muted-foreground">
            Do not store this token in long-lived storage. Regenerate after Supabase session refresh or
            when requests begin failing with 401 responses.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Supabase identity used to scope every API call.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Info label="User ID" value={user?.id ?? "Unknown"} />
          <Info label="Email" value={user?.email ?? "—"} />
          <Info label="Provider" value={user?.app_metadata?.provider ?? "password"} />
          <Info label="Session expires" value={formattedSessionExpiry} />
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-all">{value}</p>
    </div>
  );
}

function formatEpoch(epochSeconds?: number | null) {
  if (!epochSeconds) return "—";
  const millis = epochSeconds > 1e12 ? epochSeconds : epochSeconds * 1000;
  return new Date(millis).toLocaleString();
}
