import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { envServer } from "@internal/core";
import type { Database } from "@/types/database";

let cachedAdminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createServiceRoleClient() {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient<Database>(
    envServer.NEXT_PUBLIC_SUPABASE_URL,
    envServer.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return cachedAdminClient;
}

export async function fetchUserByEmail(email: string): Promise<User | null> {
  const baseUrl = envServer.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const url = new URL("/auth/v1/admin/users", baseUrl);
  url.searchParams.set("email", email);

  const response = await fetch(url, {
    headers: {
      apikey: envServer.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${envServer.SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Supabase user by email: ${response.statusText}`);
  }

  const payload = (await response.json()) as { users?: User[] };
  return payload?.users?.[0] ?? null;
}
