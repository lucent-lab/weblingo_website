import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { Translator } from "@internal/i18n";

const navLinks = [
  { href: "/pricing", labelKey: "nav.pricing" },
  { href: "/docs", labelKey: "nav.docs" },
  { href: "/try", labelKey: "nav.try" },
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={`/${locale}${link.href}`}
              className="transition hover:text-primary focus-visible:text-primary"
            >
              {t(link.labelKey)}
            </Link>
          ))}
          <Link
            href={`/${locale}/legal/terms`}
            className="transition hover:text-primary focus-visible:text-primary"
          >
            {t("nav.legal")}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="transition hover:text-primary focus-visible:text-primary"
          >
            {t("nav.login")}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="sm:hidden">
            <Link href={`/${locale}/pricing`}>{t("nav.pricing")}</Link>
          </Button>
          <Button asChild>
            <Link href={`/${locale}/checkout`}>{t("nav.start")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
