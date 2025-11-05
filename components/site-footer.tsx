import Link from "next/link";

import type { Translator } from "@internal/i18n";

type SiteFooterProps = {
  locale: string;
  t: Translator;
};

export function SiteFooter({ locale, t }: SiteFooterProps) {
  return (
    <footer className="border-t border-border bg-muted py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 text-sm text-muted-foreground md:grid-cols-[2fr_1fr_1fr] md:items-start">
        <div className="space-y-3">
          <p className="text-foreground">WebLingo</p>
          <p className="max-w-sm">{t("footer.tagline")}</p>
        </div>
        <div className="grid gap-2">
          <Link href={`/${locale}/pricing`} className="transition hover:text-primary">
            {t("nav.pricing")}
          </Link>
          <Link href={`/${locale}/docs`} className="transition hover:text-primary">
            {t("nav.docs")}
          </Link>
          <Link href={`/${locale}/try`} className="transition hover:text-primary">
            {t("nav.try")}
          </Link>
        </div>
        <div className="grid gap-2">
          <Link href={`/${locale}/contact`} className="transition hover:text-primary">
            {t("footer.contact")}
          </Link>
          <Link href={`/${locale}/legal/terms`} className="transition hover:text-primary">
            {t("footer.terms")}
          </Link>
          <Link href={`/${locale}/legal/privacy`} className="transition hover:text-primary">
            {t("footer.privacy")}
          </Link>
          <Link href={`/${locale}/legal/notice`} className="transition hover:text-primary">
            {t("nav.legal")}
          </Link>
        </div>
        <div className="md:col-span-3 text-xs text-muted-foreground">
          {t("footer.copyright", undefined, {
            year: new Date().getFullYear().toString(),
          })}
        </div>
      </div>
    </footer>
  );
}
