"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            href={item.href}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            <span className="flex-1 text-left">{item.label}</span>
            {isActive ? <ChevronRight className="h-4 w-4" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
