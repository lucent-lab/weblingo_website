import Link from "next/link";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeaderMobileMenu } from "@/components/site-header-mobile-menu";
import { envServer } from "@internal/core/env-server";
import type { Translator } from "@internal/i18n";

const navLinks = [
  { href: "#features", labelKey: "nav.features" },
  { href: "#how-it-works", labelKey: "nav.how" },
  { href: "/pricing", labelKey: "nav.pricing" },
  { href: "/docs", labelKey: "nav.docs" },
  { href: "/blog", labelKey: "nav.blog" },
];

type SiteHeaderProps = {
  locale: string;
  t: Translator;
};

export function SiteHeader({ locale, t }: SiteHeaderProps) {
  const tryHref = `/${locale}#try`;
  const portalEnabled = envServer.PUBLIC_PORTAL_MODE === "enabled";
  const resolvedNavLinks = navLinks.map((link) => ({
    ...link,
    href: link.href.startsWith("#")
      ? `/${locale}${link.href}`
      : `/${locale}${link.href.startsWith("/") ? link.href : `/${link.href}`}`,
  }));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Globe className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="truncate text-xl font-bold text-foreground">WebLingo</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {resolvedNavLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-foreground">
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4 sm:flex">
          {portalEnabled ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/login`}>{t("nav.login")}</Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href={tryHref}>{t("nav.try")}</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2 sm:hidden">
          <Button asChild size="sm" className="px-3">
            <Link href={tryHref}>{t("nav.try")}</Link>
          </Button>
          <SiteHeaderMobileMenu
            label={t("nav.menu")}
            links={[
              ...resolvedNavLinks.map((link) => ({
                href: link.href,
                label: t(link.labelKey),
              })),
              ...(portalEnabled ? [{ href: `/${locale}/login`, label: t("nav.login") }] : []),
            ]}
          />
        </div>
      </div>
    </header>
  );
}
