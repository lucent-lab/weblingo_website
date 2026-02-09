import "server-only";

import { z } from "zod";

import { clientEnvSchema, readClientEnv } from "./env";

const serverEnvSchema = z.object({
  HOME_PAGE_VARIANT: z.enum(["classic", "expansion"]).default("expansion"),
  PUBLIC_PORTAL_MODE: z.enum(["enabled", "disabled"]),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICING_TABLE_ID: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_EN: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_FR: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_JA: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TRY_NOW_TOKEN: z.string().min(1).optional(),
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

  const hasPreviewToken = Boolean(env.TRY_NOW_TOKEN);
  if (hasPreviewToken && !env.NEXT_PUBLIC_WEBHOOKS_API_BASE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["NEXT_PUBLIC_WEBHOOKS_API_BASE"],
      message: "NEXT_PUBLIC_WEBHOOKS_API_BASE is required when TRY_NOW_TOKEN is set.",
    });
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;

const readServerEnv = () => ({
  HOME_PAGE_VARIANT: process.env.HOME_PAGE_VARIANT,
  PUBLIC_PORTAL_MODE: process.env.PUBLIC_PORTAL_MODE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID,
  STRIPE_PRICING_TABLE_ID_EN: process.env.STRIPE_PRICING_TABLE_ID_EN,
  STRIPE_PRICING_TABLE_ID_FR: process.env.STRIPE_PRICING_TABLE_ID_FR,
  STRIPE_PRICING_TABLE_ID_JA: process.env.STRIPE_PRICING_TABLE_ID_JA,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  TRY_NOW_TOKEN: process.env.TRY_NOW_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
});

export const envServer: FullEnv = fullEnvSchema.parse({
  ...readClientEnv(),
  ...readServerEnv(),
});
