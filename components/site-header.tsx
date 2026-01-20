import Link from "next/link";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { env } from "@internal/core";
import type { Translator } from "@internal/i18n";

const navLinks = [
  { href: "#features", labelKey: "nav.features" },
  { href: "#how-it-works", labelKey: "nav.how" },
  { href: "/pricing", labelKey: "nav.pricing" },
];

type SiteHeaderProps = {
  locale: string;
  t: Translator;
};

export function SiteHeader({ locale, t }: SiteHeaderProps) {
  const tryHref = `/${locale}#try`;
  const portalEnabled = env.PUBLIC_PORTAL_MODE === "enabled";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Globe className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">WebLingo</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {navLinks.map((link) => {
            const href = link.href.startsWith("#")
              ? `/${locale}${link.href}`
              : `/${locale}${link.href.startsWith("/") ? link.href : `/${link.href}`}`;
            return (
              <Link key={link.href} href={href} className="transition hover:text-foreground">
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          {portalEnabled ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/login`}>{t("nav.login")}</Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href={tryHref}>{t("nav.try")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
