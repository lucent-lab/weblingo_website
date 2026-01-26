import type { MetadataRoute } from "next";

import { posts } from "@/content/blog";
import { docs } from "@/content/docs";
import { env } from "@internal/core";
import { i18nConfig } from "@internal/i18n";

const baseRoutes = [
  "",
  "/pricing",
  "/contact",
  "/try",
  "/docs",
  "/blog",
  "/legal/terms",
  "/legal/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const docRoutes = docs.map((doc) => `/docs/${doc.slug.join("/")}`);
  const blogRoutes = posts.map((post) => `/blog/${post.slug}`);
  const allRoutes = [...baseRoutes, ...docRoutes, ...blogRoutes];

  return i18nConfig.locales.flatMap((locale) =>
    allRoutes.map((route) => ({
      url: `${env.NEXT_PUBLIC_APP_URL}/${locale}${route}`,
      lastModified,
    })),
  );
}
