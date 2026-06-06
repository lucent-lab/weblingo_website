"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import { cn } from "@/lib/utils";

export type SiteNavEntry = {
  id: string;
  label: string;
  status: "active" | "inactive";
};

type SitesNavProps = {
  sites: SiteNavEntry[];
  dashboardLocale?: string | null;
  emptyLabel?: string;
};

export function SitesNav({
  sites,
  dashboardLocale = null,
  emptyLabel = "No sites yet.",
}: SitesNavProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarMenu>
      {isCollapsed ? null : sites.length === 0 ? (
        <SidebarMenuItem className="px-2 py-2 text-xs text-sidebar-foreground/70">
          {emptyLabel}
        </SidebarMenuItem>
      ) : (
        sites.map((site) => (
          <SiteNavItem
            key={site.id}
            site={site}
            dashboardLocale={dashboardLocale}
            pathname={pathname}
          />
        ))
      )}
    </SidebarMenu>
  );
}

type SiteNavItemProps = {
  site: SiteNavEntry;
  dashboardLocale: string | null;
  pathname: string | null;
};

function SiteNavItem({ site, dashboardLocale, pathname }: SiteNavItemProps) {
  const basePath = `/dashboard/sites/${site.id}`;
  const isActive = Boolean(
    pathname && (pathname === basePath || pathname.startsWith(`${basePath}/`)),
  );
  const [manualOpen, setManualOpen] = useState(false);
  const open = isActive || manualOpen;
  const menuId = `site-nav-${site.id}`;

  const subItems = [
    { path: basePath, label: "Workspace" },
    { path: `${basePath}/pages`, label: "Pages & crawl" },
    { path: `${basePath}/domains`, label: "Domains" },
    { path: `${basePath}/source-selection`, label: "Source selection" },
    { path: `${basePath}/quality`, label: "Quality" },
    { path: `${basePath}/developer-tools`, label: "Developer tools" },
    { path: `${basePath}/runtime-requests`, label: "Runtime requests" },
    { path: `${basePath}/history`, label: "History" },
    { path: `${basePath}/overrides`, label: "Translation rules" },
    { path: `${basePath}/settings`, label: "Settings" },
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
              const href = withDashboardLocale(item.path, dashboardLocale);
              const isItemActive = pathname === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={isItemActive} size="sm">
                    <Link
                      href={href}
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
