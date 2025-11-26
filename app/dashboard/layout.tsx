import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardNav } from "./_components/dashboard-nav";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/logout/actions";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  robots: { index: false, follow: false },
};

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sites", label: "Sites" },
  { href: "/dashboard/sites/new", label: "New site" },
  { href: "/dashboard/developer-tools", label: "Developer tools" },
];

type DashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!session || !user) {
    redirect("/auth/login");
  }

  const email = user.email ?? "demo@weblingo.com";

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">WebLingo Dashboard</p>
            <h1 className="text-3xl font-semibold">Manage your translated sites</h1>
            <p className="text-sm text-muted-foreground">
              Onboard new sites, monitor deployments, and fine-tune translations.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Signed in
              </span>
              <span className="text-sm font-medium">{email}</span>
            </div>
            <form action={logout}>
              <Button size="sm" variant="outline" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Navigation</p>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Beta
              </span>
            </div>
            <div className="mt-4">
              <DashboardNav items={navItems} />
            </div>
            <div className="mt-6 space-y-1 rounded-md bg-muted/70 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Need help?</p>
              <p>Check DNS instructions on each domain or email support@weblingo.com.</p>
            </div>
          </aside>

          <main
            className={cn(
              "rounded-xl border border-border bg-background p-6 shadow-sm",
              "flex flex-col gap-6",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
