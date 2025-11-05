import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLIC_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICING_TABLE_ID: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_EN: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_FR: z.string().min(1).optional(),
  STRIPE_PRICING_TABLE_ID_JA: z.string().min(1).optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID,
  STRIPE_PRICING_TABLE_ID_EN: process.env.STRIPE_PRICING_TABLE_ID_EN,
  STRIPE_PRICING_TABLE_ID_FR: process.env.STRIPE_PRICING_TABLE_ID_FR,
  STRIPE_PRICING_TABLE_ID_JA: process.env.STRIPE_PRICING_TABLE_ID_JA,
});
