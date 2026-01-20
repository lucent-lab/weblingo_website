import { env } from "@internal/core";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireDashboardAuth } from "@internal/dashboard/auth";

export const metadata = {
  title: "Developer tools",
  robots: { index: false, follow: false },
};

export default async function DeveloperToolsPage() {
  const auth = await requireDashboardAuth();
  const formattedSessionExpiry = formatEpoch(auth.session?.expires_at);
  const token = auth.webhooksAuth?.token;
  const expiresAt = auth.webhooksAuth?.expiresAt ?? "—";
  const user = auth.user;
  const authorizationHeader = token ? `Bearer ${token}` : "Not authenticated";
  const expiryLabel = token ? `Expires at ${expiresAt}` : "No token";
  const tokenBadgeVariant = token ? "outline" : "destructive";

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
              Short-lived token derived from your Supabase session. Refresh on load, before expiry,
              and on 401 responses.
            </CardDescription>
          </div>
          <Badge variant={tokenBadgeVariant}>{expiryLabel}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <label className="text-xs font-semibold uppercase text-muted-foreground">
            Authorization header
          </label>
          <Input readOnly value={authorizationHeader} />
          <p className="text-xs text-muted-foreground">
            Do not store this token in long-lived storage. Regenerate from the Supabase session
            before expiry or whenever the API returns 401.
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
