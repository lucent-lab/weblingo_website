"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

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
    <SidebarMenu>
      {items.map((item) => {
        const isActive = pathname !== null && item.href === activeHref;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                <span className="truncate group-data-[collapsible=icon]:sr-only">{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
