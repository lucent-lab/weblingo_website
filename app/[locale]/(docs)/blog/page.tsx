import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { posts } from "@/content/blog";
import { env } from "@internal/core";
import { i18nConfig, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold text-foreground">{t("nav.blog")}</h1>
        <p className="text-base text-muted-foreground">{t("blog.subtitle")}</p>
      </header>

      <div className="grid gap-4">
        {posts.map((post) => {
          const href = `/${locale}/blog/${post.slug}`;
          const formattedDate = formatter.format(new Date(post.date));
          return (
            <Link key={post.slug} href={href} className="group">
              <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">{post.title}</CardTitle>
                  <CardDescription className="flex flex-col gap-2">
                    <span>{post.description}</span>
                    <time dateTime={post.date} className="text-xs uppercase tracking-wide">
                      {formattedDate}
                    </time>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    {t("blog.read")}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const path = `/${locale}/blog`;

  return {
    title: t("blog.meta.title", "Blog | WebLingo"),
    description: t(
      "blog.meta.description",
      "Product updates, localization insights, and release notes from WebLingo.",
    ),
    alternates: {
      canonical: `${baseUrl}${path}`,
      languages: Object.fromEntries(
        i18nConfig.locales.map((code) => [code, `${baseUrl}/${code}/blog`]),
      ),
    },
  };
}
