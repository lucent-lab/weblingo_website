import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

const headingBase = "scroll-mt-24 font-semibold tracking-tight text-foreground";
const paragraphBase = "leading-7 text-muted-foreground";
const listBase = "ml-6 list-disc text-muted-foreground";
const orderedListBase = "ml-6 list-decimal text-muted-foreground";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ className, ...props }: ComponentPropsWithoutRef<"h1">) => (
      <h1 className={cn(headingBase, "text-3xl md:text-4xl", className)} {...props} />
    ),
    h2: ({ className, ...props }: ComponentPropsWithoutRef<"h2">) => (
      <h2 className={cn(headingBase, "mt-10 text-2xl", className)} {...props} />
    ),
    h3: ({ className, ...props }: ComponentPropsWithoutRef<"h3">) => (
      <h3 className={cn(headingBase, "mt-8 text-xl", className)} {...props} />
    ),
    p: ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
      <p className={cn(paragraphBase, "mt-4", className)} {...props} />
    ),
    a: ({ className, href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
      const isInternal = href.startsWith("/") || href.startsWith("#");
      const linkClass = cn(
        "font-medium text-primary underline-offset-4 hover:underline",
        className,
      );
      if (isInternal) {
        return <Link href={href} className={linkClass} {...props} />;
      }
      return (
        <a href={href} className={linkClass} rel="noreferrer noopener" target="_blank" {...props} />
      );
    },
    ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={cn(listBase, "mt-4", className)} {...props} />
    ),
    ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={cn(orderedListBase, "mt-4", className)} {...props} />
    ),
    li: ({ className, ...props }: ComponentPropsWithoutRef<"li">) => (
      <li className={cn("mt-2", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className={cn(
          "mt-6 border-l-2 border-primary/60 pl-4 italic text-muted-foreground",
          className,
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }: ComponentPropsWithoutRef<"hr">) => (
      <hr className={cn("my-8 border-border", className)} {...props} />
    ),
    table: ({ className, ...props }: ComponentPropsWithoutRef<"table">) => (
      <div className="mt-6 overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", className)} {...props} />
      </div>
    ),
    th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
      <th
        className={cn("border-b border-border px-3 py-2 text-left font-semibold", className)}
        {...props}
      />
    ),
    td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
      <td className={cn("border-b border-border px-3 py-2", className)} {...props} />
    ),
    pre: ({ className, ...props }: ComponentPropsWithoutRef<"pre">) => (
      <pre
        className={cn(
          "mt-6 overflow-x-auto rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground",
          className,
        )}
        {...props}
      />
    ),
    code: ({ className, ...props }: ComponentPropsWithoutRef<"code">) => {
      const isBlock = className?.includes("language-");
      return (
        <code
          className={cn(
            isBlock
              ? "font-mono text-sm text-foreground"
              : "rounded bg-muted px-1.5 py-0.5 text-xs",
            className,
          )}
          {...props}
        />
      );
    },
    ...components,
  };
}
