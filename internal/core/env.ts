import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICING_TABLE_ID: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_EN: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_FR: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_JA: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const fullEnvSchema = clientEnvSchema.merge(serverEnvSchema);

type FullEnv = z.infer<typeof fullEnvSchema>;

const readClientEnv = () => ({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const readServerEnv = () => ({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID,
  STRIPE_PRICING_TABLE_ID_EN: process.env.STRIPE_PRICING_TABLE_ID_EN,
  STRIPE_PRICING_TABLE_ID_FR: process.env.STRIPE_PRICING_TABLE_ID_FR,
  STRIPE_PRICING_TABLE_ID_JA: process.env.STRIPE_PRICING_TABLE_ID_JA,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
});

const isServer = typeof window === "undefined";

const runtimeEnv = isServer
  ? fullEnvSchema.parse({ ...readClientEnv(), ...readServerEnv() })
  : clientEnvSchema.parse(readClientEnv());

export const env = runtimeEnv as FullEnv;
