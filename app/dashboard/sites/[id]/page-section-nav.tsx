import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionLink = {
  href: string;
  label: string;
};

export function PageSectionNav({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: SectionLink[];
}) {
  return (
    <Card className="border-border/60 bg-muted/20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label={title} className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "justify-start",
              })}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
