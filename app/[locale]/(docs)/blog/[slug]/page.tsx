import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPostBySlug, posts } from "@/content/blog";
import { env } from "@internal/core";
import { i18nConfig, normalizeLocale, resolveLocaleTranslator } from "@internal/i18n";

export const dynamicParams = false;

export async function generateStaticParams() {
  return i18nConfig.locales.flatMap((locale) =>
    posts.map((post) => ({
      locale,
      slug: post.slug,
    })),
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    notFound();
  }

  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const post = getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const PostComponent = post.component;

  return (
    <article className="mx-auto w-full max-w-3xl pb-16">
      <div className="space-y-4 pb-8">
        <Button asChild variant="ghost" className="gap-2 px-0">
          <Link href={`/${locale}/blog`}>
            <ArrowLeft className="h-4 w-4" />
            {t("blog.back")}
          </Link>
        </Button>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold text-foreground">{post.title}</h1>
          <p className="text-lg text-muted-foreground">{post.description}</p>
          <time
            dateTime={post.date}
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            {formatter.format(new Date(post.date))}
          </time>
        </div>
      </div>

      <PostComponent />
    </article>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeLocale(rawLocale);
  if (locale !== rawLocale) {
    return {};
  }

  const post = getPostBySlug(slug);
  if (!post) {
    return {};
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const path = `/${locale}/blog/${post.slug}`;

  return {
    title: `${post.title} | WebLingo`,
    description: post.description,
    alternates: {
      canonical: `${baseUrl}${path}`,
      languages: Object.fromEntries(
        i18nConfig.locales.map((code) => [code, `${baseUrl}/${code}/blog/${post.slug}`]),
      ),
    },
  };
}
