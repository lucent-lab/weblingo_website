import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "./env";

export function createClient() {
  const env = getSupabasePublicEnv();
  return createBrowserClient<Database>(env.url, env.publishableKey);
}
