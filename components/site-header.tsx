import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Translator } from "@internal/i18n";

const navLinks = [
  { href: "/pricing#compare", labelKey: "nav.features" },
  { href: "#how-it-works", labelKey: "nav.how" },
  { href: "/pricing", labelKey: "nav.pricing" },
  { href: "#faq", labelKey: "nav.faq" },
];

type SiteHeaderProps = {
  locale: string;
  t: Translator;
};

export function SiteHeader({ locale, t }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href={`/${locale}`} className="text-base font-semibold text-foreground">
          WebLingo
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {navLinks.map((link) => {
            const href = `/${locale}${
              link.href.startsWith("/") || link.href.startsWith("#") ? link.href : `/${link.href}`
            }`;
            return (
              <Link
                key={link.href}
                href={href}
                className="transition hover:text-primary focus-visible:text-primary"
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href={`/${locale}/try`}>{t("nav.try")}</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href={`/${locale}/pricing`}>{t("nav.start")}</Link>
          </Button>
          <Button asChild variant="ghost" className="sm:hidden">
            <Link href={`/${locale}/try`}>{t("nav.try")}</Link>
          </Button>
          <Button asChild className="sm:hidden">
            <Link href={`/${locale}/pricing`}>{t("nav.start")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
