import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InternalAdminPolicyCardProps = {
  accountId: string;
  planType: string | null;
  planStatus: string | null;
  accountPolicyHref: string | null;
};

export function InternalAdminPolicyCard({
  accountId,
  planType,
  planStatus,
  accountPolicyHref,
}: InternalAdminPolicyCardProps) {
  return (
    <Card className="border-border/60 bg-muted/20">
      <CardHeader>
        <CardTitle>Policy scope</CardTitle>
        <CardDescription>
          This page edits site-level policy only. Plan assignment, managed-demo state, and
          account-level flag overrides now live on the managed account policy page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Account {accountId}</Badge>
          <Badge variant="outline">Plan {planType ?? "unknown"}</Badge>
          <Badge variant="outline">Status {planStatus ?? "unknown"}</Badge>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Plan defaults and raw account overrides apply across every site in this workspace.</p>
          <p>
            The site settings form below stays limited to safe website-level settings such as
            routing, locale coverage, serving mode, client runtime, SPA refresh, and translatable
            attributes.
          </p>
        </div>
        {accountPolicyHref ? (
          <Button asChild variant="secondary">
            <Link href={accountPolicyHref}>Open account policy</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Agency-owned workspaces are not editable from the managed-account policy surface.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
