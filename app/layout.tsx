import "../styles/globals.css";

import type { Metadata } from "next";

import { LaunchBanner } from "@/components/launch-banner";
import { cn } from "@/lib/utils";
import { env } from "@internal/core";

const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  title: {
    default: "WebLingo — AI Localization for SaaS Marketing",
    template: "%s · WebLingo",
  },
  description:
    "Launch localized marketing experiences in days, not quarters. WebLingo keeps every locale in sync with your primary site.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans text-foreground antialiased")}>
        <div className="flex min-h-screen flex-col">{children}</div>
        <LaunchBanner />
      </body>
    </html>
  );
}
