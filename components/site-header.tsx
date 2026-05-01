import { SiteHeaderBar } from "@/components/site-header-bar";
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
  const portalEnabled = envServer.PUBLIC_PORTAL_MODE === "enabled";
  const resolvedNavLinks = navLinks.map((link) => ({
    href: link.href.startsWith("#")
      ? `/${locale}${link.href}`
      : `/${locale}${link.href.startsWith("/") ? link.href : `/${link.href}`}`,
    label: t(link.labelKey),
  }));

  return (
    <SiteHeaderBar
      locale={locale}
      links={resolvedNavLinks}
      menuLabel={t("nav.menu")}
      primaryAction={{ href: `/${locale}#try`, label: t("nav.try") }}
      secondaryAction={
        portalEnabled
          ? { href: `/${locale}/login`, label: t("nav.login"), variant: "outline" }
          : undefined
      }
    />
  );
}
