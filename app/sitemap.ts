import type { MetadataRoute } from "next";

import { env } from "@internal/core";
import { i18nConfig } from "@internal/i18n";

const baseRoutes = ["", "/pricing", "/contact", "/checkout", "/legal/terms", "/legal/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return i18nConfig.locales.flatMap((locale) =>
    baseRoutes.map((route) => ({
      url: `${env.NEXT_PUBLIC_APP_URL}/${locale}${route}`,
      lastModified,
    })),
  );
}
