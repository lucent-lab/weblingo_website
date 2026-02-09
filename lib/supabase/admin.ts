import "server-only";

import { createClient, type User } from "@supabase/supabase-js";

import { envServer } from "@internal/core/env-server";
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

  const timeoutMs = Number(envServer.SUPABASE_AUTH_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error("[config] SUPABASE_AUTH_TIMEOUT_MS must be a positive integer");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: envServer.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${envServer.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    const label = controller.signal.aborted ? "timed_out" : "fetch_failed";
    throw new Error(`Supabase admin user lookup ${label}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch Supabase user by email: ${response.statusText}`);
  }

  const payload = (await response.json()) as { users?: User[] };
  return payload?.users?.[0] ?? null;
}
