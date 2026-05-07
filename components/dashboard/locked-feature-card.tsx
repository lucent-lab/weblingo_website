import Link from "next/link";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LockedFeatureCard({
  badgeLabel = "Locked",
  ctaLabel = "Upgrade plan",
  description,
  pricingPath,
  title,
}: {
  badgeLabel?: string;
  ctaLabel?: string;
  description: string;
  pricingPath: string;
  title: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button asChild variant="secondary">
          <Link href={pricingPath}>{ctaLabel}</Link>
        </Button>
        <StatusBadge>{badgeLabel}</StatusBadge>
      </CardContent>
    </Card>
  );
}
