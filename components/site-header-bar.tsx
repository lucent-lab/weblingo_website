"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";

import { SiteHeaderMobileMenu } from "@/components/site-header-mobile-menu";
import { SiteHeaderNav, type SiteHeaderNavLink } from "@/components/site-header-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderAction = {
  href: string;
  label: string;
  variant?: "default" | "outline";
};

type SiteHeaderBarProps = {
  locale: string;
  links: SiteHeaderNavLink[];
  menuLabel: string;
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
  extraControl?: ReactNode;
  extraControlPosition?: "left" | "right";
  showBrand?: boolean;
  className?: string;
  innerClassName?: string;
};

export function SiteHeaderBar({
  locale,
  links,
  menuLabel,
  primaryAction,
  secondaryAction,
  extraControl,
  extraControlPosition = "right",
  showBrand = true,
  className,
  innerClassName,
}: SiteHeaderBarProps) {
  const mobileLinks = [
    ...links,
    ...(secondaryAction ? [{ href: secondaryAction.href, label: secondaryAction.label }] : []),
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-sm",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8",
          innerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {extraControlPosition === "left" ? extraControl : null}
          {showBrand ? (
            <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Globe className="h-5 w-5" />
              </span>
              <span className="truncate text-xl font-bold text-foreground">WebLingo</span>
            </Link>
          ) : null}
        </div>

        <SiteHeaderNav links={links} />

        <div className="flex items-center gap-2">
          {extraControlPosition === "right" ? extraControl : null}
          <div className="hidden items-center gap-3 sm:flex">
            {secondaryAction ? (
              <Button asChild variant={secondaryAction.variant ?? "outline"} size="sm">
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : null}
            {primaryAction ? (
              <Button asChild variant={primaryAction.variant ?? "default"} size="sm">
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {primaryAction ? (
              <Button
                asChild
                variant={primaryAction.variant ?? "default"}
                size="sm"
                className="px-3"
              >
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : null}
            <SiteHeaderMobileMenu label={menuLabel} links={mobileLinks} />
          </div>
        </div>
      </div>
    </header>
  );
}
