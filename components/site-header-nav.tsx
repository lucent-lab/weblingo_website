"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SiteHeaderNavLink = {
  href: string;
  label: string;
};

type SiteHeaderNavProps = {
  links: SiteHeaderNavLink[];
};

export function SiteHeaderNav({ links }: SiteHeaderNavProps) {
  const pathname = usePathname() ?? "";
  const activeHref = links.reduce((best, link) => {
    if (link.href.includes("#")) {
      return best;
    }
    if (pathname === link.href || pathname.startsWith(`${link.href}/`)) {
      return link.href.length > best.length ? link.href : best;
    }
    return best;
  }, "");

  return (
    <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
      {links.map((link) => {
        const isActive = activeHref === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 transition",
              isActive ? "bg-primary/10 text-primary" : "hover:bg-accent hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
