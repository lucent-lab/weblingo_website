import "../styles/globals.css";

import type { Metadata } from "next";
import { Suspense } from "react";

import { cn } from "@/lib/utils";
import { NavigationAnalyticsTracker } from "@/components/navigation-analytics-tracker";
import { PreviewStatusRuntimeBootstrap } from "@/components/preview-status-runtime-bootstrap";
import { Sonner } from "@/components/ui/sonner";
import { env } from "@internal/core";
import { envServer } from "@internal/core/env-server";

const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  title: {
    default: "WebLingo — Static-Site Localization for Public Growth Pages",
    template: "%s · WebLingo",
  },
  description:
    "Generate a private preview of one public page and evaluate localized copy, SEO metadata, and page structure before production rollout.",
  openGraph: {
    siteName: "WebLingo",
    type: "website",
    title: "WebLingo — Static-Site Localization for Public Growth Pages",
    description:
      "Generate a private preview of one public page and evaluate localized copy, SEO metadata, and page structure before production rollout.",
  },
  twitter: {
    card: "summary",
    title: "WebLingo — Static-Site Localization for Public Growth Pages",
    description:
      "Generate a private preview of one public page and evaluate localized copy, SEO metadata, and page structure before production rollout.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html data-scroll-behavior="smooth" lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans text-foreground antialiased")}>
        <div className="flex min-h-screen flex-col">{children}</div>
        <Suspense fallback={null}>
          <NavigationAnalyticsTracker homePageVariant={envServer.HOME_PAGE_VARIANT} />
        </Suspense>
        <PreviewStatusRuntimeBootstrap />
        <Sonner />
      </body>
    </html>
  );
}
