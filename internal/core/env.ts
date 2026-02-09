import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_WEBHOOKS_API_BASE: z.string().url(),
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: z.string().regex(/^[1-9]\d*$/),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const readClientEnv = () => ({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_WEBHOOKS_API_BASE: process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE,
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS,
});

export const env: ClientEnv = clientEnvSchema.parse(readClientEnv());
