import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Unable to load Supabase user:", error);
  }

  if (!user) {
    redirect("/auth/login");
  }

  const accountFields = [
    { label: "Email", value: user.email ?? "—" },
    { label: "User ID", value: user.id },
    { label: "Created", value: formatDate(user.created_at, locale) },
    { label: "Last sign-in", value: formatDate(user.last_sign_in_at, locale) },
    { label: "Provider", value: user.app_metadata?.provider ?? "password" },
  ];

  const metadataEntries = Object.entries(user.user_metadata ?? {});

  return (
    <div className="bg-background pb-24 pt-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Account</p>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-base text-muted-foreground">
            You&apos;re signed in with Supabase. Below is the data returned for your current session.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Profile overview</CardTitle>
            <CardDescription>Key attributes pulled from your Supabase user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accountFields.map((field) => (
              <div key={field.label} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0 last:pb-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</p>
                <p className="text-sm text-foreground break-all">{field.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User metadata</CardTitle>
            <CardDescription>
              Custom fields stored in Supabase&apos;s <code>user_metadata</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metadataEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom metadata found.</p>
            ) : (
              <dl className="space-y-4">
                {metadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="text-sm text-foreground break-all">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}
