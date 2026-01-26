"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type DocsNavItem = {
  href: string;
  title: string;
};

export type DocsNavSection = {
  title: string;
  items: DocsNavItem[];
};

type HeaderLink = {
  href: string;
  label: string;
};

type DocsShellProps = {
  locale: string;
  navSections: DocsNavSection[];
  headerLinks: HeaderLink[];
  copy: {
    title: string;
    subtitle: string;
    supportTitle: string;
    supportDescription: string;
    supportCta: string;
    homeLabel: string;
  };
  children: React.ReactNode;
};

export function DocsShell({ locale, navSections, headerLinks, copy, children }: DocsShellProps) {
  const pathname = usePathname() ?? "";
  const activeHeader = headerLinks.reduce((best, link) => {
    if (pathname === link.href || pathname.startsWith(`${link.href}/`)) {
      return link.href.length > best.length ? link.href : best;
    }
    return best;
  }, "");

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-3 px-4 py-4">
          <Link href={`/${locale}/docs`} className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="truncate">{copy.title}</span>
          </Link>
          <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        </SidebarHeader>

        <SidebarContent>
          {navSections.map((section) => (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <DocsNav items={section.items} />
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-sidebar-foreground">{copy.supportTitle}</p>
            <p>{copy.supportDescription}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full bg-transparent">
              <Link href="mailto:contact@weblingo.app">{copy.supportCta}</Link>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-muted/30">
        <header className="border-b bg-background">
          <div className="flex w-full flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                <SidebarTrigger className="shrink-0" />
                <div className="hidden h-5 w-px bg-border sm:block" />
                <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  {headerLinks.map((link) => {
                    const isActive = activeHeader === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "transition",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <Link
                href={`/${locale}`}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                {copy.homeLabel}
              </Link>
            </div>
          </div>
        </header>

        <section className="flex w-full max-w-7xl min-w-0 flex-1 flex-col px-4 py-8 lg:px-6">
          {children}
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DocsNav({ items }: { items: DocsNavItem[] }) {
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
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
              <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                <span className="truncate group-data-[collapsible=icon]:sr-only">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
