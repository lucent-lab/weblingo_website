import { z } from "zod";

const POSTHOG_DIRECT_INGESTION_HOSTNAMES = new Set([
  "eu.i.posthog.com",
  "us.i.posthog.com",
  "i.posthog.com",
]);

const POSTHOG_MANAGED_PROXY_HOSTNAME = "metrics.weblingo.app";
const sampleRateSchema = z.string().refine(
  (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
  },
  { message: "must be a decimal number between 0 and 1" },
);

function normalizeUrl(value: string): string {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

export const clientEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_BROWSER_HOST: z.string().url(),
    NEXT_PUBLIC_POSTHOG_CAPTURE: z.enum(["enabled", "disabled"]),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
    NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE: z.enum(["disabled", "sampled"]),
    NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: sampleRateSchema,
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_WEBHOOKS_API_BASE: z.string().url(),
    NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: z.string().regex(/^[1-9]\d*$/),
    // Cloudflare Turnstile public site key (M12.3 bot gating). Optional: when
    // unset the widget renders nothing and server-side gating stays disabled.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    const browserHost = new URL(env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST);
    const upstreamHost = new URL(env.NEXT_PUBLIC_POSTHOG_HOST);

    if (
      normalizeUrl(env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST) ===
      normalizeUrl(env.NEXT_PUBLIC_POSTHOG_HOST)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_POSTHOG_BROWSER_HOST"],
        message:
          "NEXT_PUBLIC_POSTHOG_BROWSER_HOST must be the browser-facing proxy host, not the upstream PostHog ingestion host.",
      });
    }

    if (POSTHOG_DIRECT_INGESTION_HOSTNAMES.has(browserHost.hostname)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_POSTHOG_BROWSER_HOST"],
        message:
          "NEXT_PUBLIC_POSTHOG_BROWSER_HOST must use a first-party proxy host, not direct PostHog ingestion.",
      });
    }

    if (upstreamHost.hostname === POSTHOG_MANAGED_PROXY_HOSTNAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_POSTHOG_HOST"],
        message:
          "NEXT_PUBLIC_POSTHOG_HOST must remain the upstream PostHog ingestion host, not the browser-facing managed proxy.",
      });
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const readClientEnv = () => ({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_BROWSER_HOST: process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST,
  NEXT_PUBLIC_POSTHOG_CAPTURE: process.env.NEXT_PUBLIC_POSTHOG_CAPTURE,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE: process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE,
  NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_WEBHOOKS_API_BASE: process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE,
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});

export const env: ClientEnv = clientEnvSchema.parse(readClientEnv());
