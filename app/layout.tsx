import "../styles/globals.css";

import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { Sonner } from "@/components/ui/sonner";
import { env } from "@internal/core";

const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: appUrl ? new URL(appUrl) : undefined,
  title: {
    default: "WebLingo — Automatic Website Translation & Hosting",
    template: "%s · WebLingo",
  },
  description:
    "Translate and host your website automatically on 330+ Cloudflare locations. Keep content in sync and SEO‑ready with localized metadata and hreflang. Launch in minutes — no code required.",
  openGraph: {
    siteName: "WebLingo",
    type: "website",
    title: "WebLingo — Automatic Website Translation & Hosting",
    description:
      "Translate and host your website automatically on 330+ Cloudflare locations. Keep content in sync and SEO‑ready with localized metadata and hreflang. Launch in minutes — no code required.",
  },
  twitter: {
    card: "summary",
    title: "WebLingo — Automatic Website Translation & Hosting",
    description:
      "Translate and host your website automatically on 330+ Cloudflare locations. Keep content in sync and SEO‑ready with localized metadata and hreflang. Launch in minutes — no code required.",
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans text-foreground antialiased")}>
        <div className="flex min-h-screen flex-col">{children}</div>
        <Sonner />
      </body>
    </html>
  );
}
