const defaults: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_BROWSER_HOST: "http://localhost:3000/_analytics/posthog",
  NEXT_PUBLIC_POSTHOG_CAPTURE: "disabled",
  NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.example.com",
  NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE: "disabled",
  NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE: "0",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.com",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_anon_key",
  NEXT_PUBLIC_WEBHOOKS_API_BASE: "https://api.weblingo.example/api",
  NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS: "15000",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
