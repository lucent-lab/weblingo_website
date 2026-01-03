import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_WEBHOOKS_API_BASE: z.string().url(),
});

const serverEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICING_TABLE_ID: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_EN: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_FR: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_JA: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
});

const fullEnvSchema = clientEnvSchema.merge(serverEnvSchema).superRefine((env, ctx) => {
  const hasUpstashUrl = Boolean(env.UPSTASH_REDIS_REST_URL);
  const hasUpstashToken = Boolean(env.UPSTASH_REDIS_REST_TOKEN);
  const hasKvUrl = Boolean(env.KV_REST_API_URL);
  const hasKvToken = Boolean(env.KV_REST_API_TOKEN);

  if (hasUpstashUrl !== hasUpstashToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasUpstashUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
      message: "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required together.",
    });
  }

  if (hasKvUrl !== hasKvToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasKvUrl ? "KV_REST_API_TOKEN" : "KV_REST_API_URL"],
      message: "Both KV_REST_API_URL and KV_REST_API_TOKEN are required together.",
    });
  }

  if (!(hasUpstashUrl && hasUpstashToken) && !(hasKvUrl && hasKvToken)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["UPSTASH_REDIS_REST_URL"],
      message:
        "Missing Redis credentials. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.",
    });
  }
});

type FullEnv = z.infer<typeof fullEnvSchema>;

const readClientEnv = () => ({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_WEBHOOKS_API_BASE: process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE,
});

const readServerEnv = () => ({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID,
  STRIPE_PRICING_TABLE_ID_EN: process.env.STRIPE_PRICING_TABLE_ID_EN,
  STRIPE_PRICING_TABLE_ID_FR: process.env.STRIPE_PRICING_TABLE_ID_FR,
  STRIPE_PRICING_TABLE_ID_JA: process.env.STRIPE_PRICING_TABLE_ID_JA,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
});

const isServer = typeof window === "undefined";

const runtimeEnv = isServer
  ? fullEnvSchema.parse({ ...readClientEnv(), ...readServerEnv() })
  : clientEnvSchema.parse(readClientEnv());

export const env = runtimeEnv as FullEnv;
