import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LockedFeatureCard({
  title,
  description,
  pricingPath,
  ctaLabel = "Upgrade plan",
  badgeLabel = "Locked",
}: {
  title: string;
  description: string;
  pricingPath: string;
  ctaLabel?: string;
  badgeLabel?: string;
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
        <Badge variant="outline">{badgeLabel}</Badge>
      </CardContent>
    </Card>
  );
}
