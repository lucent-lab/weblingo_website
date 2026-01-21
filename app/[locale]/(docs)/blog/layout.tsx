import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";

import { normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function BlogLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  if (locale !== rawLocale) {
    notFound();
  }

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));

  return (
    <div className="bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Globe className="h-4 w-4" />
            </span>
            <span>WebLingo</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href={`/${locale}/docs`}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {t("nav.docs")}
            </Link>
            <Link href={`/${locale}/blog`} className="text-foreground">
              {t("nav.blog")}
            </Link>
          </nav>
          <Link
            href={`/${locale}`}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            {t("nav.home")}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 lg:px-6">{children}</main>
    </div>
  );
}
