"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type SiteNavEntry = {
  id: string;
  label: string;
  status: "active" | "inactive";
};

type SitesNavProps = {
  sites: SiteNavEntry[];
};

export function SitesNav({ sites }: SitesNavProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const allSitesActive = pathname === "/dashboard/sites";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={allSitesActive} tooltip="All sites">
          <Link href="/dashboard/sites" aria-current={allSitesActive ? "page" : undefined}>
            <Globe className="h-4 w-4 shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:sr-only">All sites</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {isCollapsed ? null : sites.length === 0 ? (
        <SidebarMenuItem className="px-2 py-2 text-xs text-sidebar-foreground/70">
          No sites yet.
        </SidebarMenuItem>
      ) : (
        sites.map((site) => <SiteNavItem key={site.id} site={site} pathname={pathname} />)
      )}
    </SidebarMenu>
  );
}

type SiteNavItemProps = {
  site: SiteNavEntry;
  pathname: string | null;
};

function SiteNavItem({ site, pathname }: SiteNavItemProps) {
  const baseHref = `/dashboard/sites/${site.id}`;
  const isActive = Boolean(
    pathname && (pathname === baseHref || pathname.startsWith(`${baseHref}/`)),
  );
  const [manualOpen, setManualOpen] = useState(false);
  const open = isActive || manualOpen;
  const menuId = `site-nav-${site.id}`;

  const subItems = [
    { href: baseHref, label: "Configuration" },
    { href: `${baseHref}/pages`, label: "Pages" },
    { href: `${baseHref}/overrides`, label: "Overrides" },
    { href: `${baseHref}/admin`, label: "Admin" },
  ];

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        onClick={() => setManualOpen((prev) => (isActive ? true : !prev))}
        isActive={isActive}
        aria-expanded={open}
        aria-controls={menuId}
        className="justify-between"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              site.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/50",
            )}
          />
          <span className="truncate group-data-[collapsible=icon]:sr-only">{site.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </SidebarMenuButton>
      {open ? (
        <div id={menuId} className="ml-4 border-l border-sidebar-border pl-3">
          <SidebarMenu className="gap-0.5">
            {subItems.map((item) => {
              const isItemActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isItemActive} size="sm">
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={isItemActive ? "page" : undefined}
                    >
                      <span className="truncate group-data-[collapsible=icon]:sr-only">
                        {item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      ) : null}
    </SidebarMenuItem>
  );
}
