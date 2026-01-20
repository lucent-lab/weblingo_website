import Link from "next/link";
import { Globe } from "lucide-react";

import type { Translator } from "@internal/i18n";

type SiteFooterProps = {
  locale: string;
  t: Translator;
};

export function SiteFooter({ locale, t }: SiteFooterProps) {
  return (
    <footer className="border-t border-border bg-secondary/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl text-sm text-muted-foreground">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                <Globe className="h-4 w-4 text-primary-foreground" />
              </div>
              <p className="font-bold">WebLingo</p>
            </div>
            <p className="max-w-sm">{t("footer.tagline")}</p>
          </div>
          <div className="grid gap-2">
            <Link href={`/${locale}/pricing`} className="transition hover:text-foreground">
              {t("nav.pricing")}
            </Link>
            <Link href={`/${locale}/docs`} className="transition hover:text-foreground">
              {t("nav.docs")}
            </Link>
            <Link href={`/${locale}#try`} className="transition hover:text-foreground">
              {t("nav.try")}
            </Link>
          </div>
          <div className="grid gap-2">
            <Link href={`/${locale}/contact`} className="transition hover:text-foreground">
              {t("footer.contact")}
            </Link>
            <Link href={`/${locale}/legal/terms`} className="transition hover:text-foreground">
              {t("footer.terms")}
            </Link>
            <Link href={`/${locale}/legal/privacy`} className="transition hover:text-foreground">
              {t("footer.privacy")}
            </Link>
            <Link href={`/${locale}/legal/notice`} className="transition hover:text-foreground">
              {t("footer.notice")}
            </Link>
          </div>
        </div>
        <div className="mt-12 border-t border-border pt-8 text-center text-xs text-muted-foreground">
          {t("footer.copyright", undefined, {
            year: new Date().getFullYear().toString(),
          })}
        </div>
      </div>
    </footer>
  );
}
