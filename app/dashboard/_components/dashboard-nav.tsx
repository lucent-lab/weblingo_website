"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const activeHref = pathname
    ? items.reduce((best, item) => {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          return item.href.length > best.length ? item.href : best;
        }
        return best;
      }, "")
    : "";

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname !== null && item.href === activeHref;
        return (
          <Link
            key={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
