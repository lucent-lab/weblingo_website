# Recommended Structure for Single Website (Package‑Ready)

This keeps one app today, while making future extraction to packages almost trivial.

---

## Directory Layout

```
/web
  /app
  /components
  /styles
  /public

  /internal               # "proto-packages" (later become /packages/*)
    /core                 # env, logger, errors, types
    /auth                 # auth client/server wrappers (no UI)
    /db                   # supabase client, queries, migration glue
    /billing              # stripe client + webhook + plan map
    /i18n                 # translation loader, t(), locale utils
    /seo                  # meta builders, sitemap/robots generators
    /analytics            # shared analytics facade
    /ui                   # minimal shared primitives

  /modules                # feature slices using the facades
    /pricing
    /account
    /dashboard

  /scripts                # sql, seeds, ops helpers
  next.config.js
  package.json
  tsconfig.json
  .eslintrc.cjs
```

---

## Principles

- **One app now**, but organized as “proto‑packages” under `/internal/`.
- Each module exposes a **public barrel** (`index.ts`). No deep imports.
- **Path aliases** everywhere so later extraction is a search‑and‑replace.
- Single env reader in `@internal/core`; others accept params, not process.env.

---

## `tsconfig.json` (path aliases)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@internal/core": ["./internal/core"],
      "@internal/auth": ["./internal/auth"],
      "@internal/db": ["./internal/db"],
      "@internal/billing": ["./internal/billing"],
      "@internal/i18n": ["./internal/i18n"],
      "@internal/seo": ["./internal/seo"],
      "@internal/analytics": ["./internal/analytics"],
      "@internal/ui": ["./internal/ui"]
    },
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

## Import rule (prevent deep imports)

```js
// .eslintrc.cjs
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  rules: {
    // Only import from each module's barrel (index.ts)
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@internal/*/*"],
            message: "Import from the module root barrel only (no deep paths).",
          },
        ],
      },
    ],
  },
};
```

---

## Minimal facades (stable public APIs)

> Keep these tiny, so feature code never touches implementation details.

### Billing

```ts
// internal/billing/plans.ts
export const PLANS = {
  free: { priceId: null, features: ["basic"] },
  pro: { priceId: "price_XXX", features: ["basic", "pro"] },
} as const;
export type PlanKey = keyof typeof PLANS;
```

```ts
// internal/billing/client.ts
import Stripe from "stripe";
import { env } from "@internal/core";

const stripe = new Stripe(env.STRIPE_SECRET, { apiVersion: "2024-06-20" });

export async function createCheckout(opts: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    customer: opts.customerId,
  });
}

export async function getPortalUrl(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export function getActivePlan(lookupKey?: string | null) {
  // simple helper to map price lookup keys -> internal plan keys
  if (!lookupKey) return "free" as const;
  if (lookupKey.includes("pro")) return "pro" as const;
  return "free" as const;
}
```

```ts
// internal/billing/webhook.ts
import Stripe from "stripe";
import { env } from "@internal/core";

export function stripeWebhookHandler(rawBody: string, signature: string) {
  const stripe = new Stripe(env.STRIPE_SECRET, { apiVersion: "2024-06-20" });
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  // TODO: mutate your DB based on event.type
  return { ok: true, type: event.type };
}
```

```ts
// internal/billing/index.ts
export { createCheckout, getPortalUrl, getActivePlan } from "./client";
export { stripeWebhookHandler } from "./webhook";
export { PLANS } from "./plans";
```

### i18n

```ts
// internal/i18n/config.ts
export const i18nConfig = {
  defaultLocale: "ja",
  locales: ["ja", "en"],
} as const;
```

```ts
// internal/i18n/server.ts
import { i18nConfig } from "./config";
export async function loadMessages(locale: string) {
  const l = i18nConfig.locales.includes(locale as any) ? locale : i18nConfig.defaultLocale;
  return (await import(`../../messages/${l}.json`)).default;
}
export function detectLocale(headers: Headers) {
  const h = headers.get("accept-language") || "";
  return h.startsWith("en") ? "en" : i18nConfig.defaultLocale;
}
```

```ts
// internal/i18n/client.ts
let cur = "ja";
let dict: Record<string, string> = {};
export function setLocale(locale: string, messages: Record<string, string>) {
  cur = locale;
  dict = messages;
}
export function getLocale() {
  return cur;
}
export function t(key: string, fallback?: string) {
  return dict[key] ?? fallback ?? key;
}
```

```ts
// internal/i18n/index.ts
export { setLocale, getLocale, t } from "./client";
export { loadMessages, detectLocale } from "./server";
export { i18nConfig } from "./config";
```

### DB (Supabase)

```ts
// internal/db/client.ts
import { createBrowserClient, createServerClient as createSbServer } from "@supabase/ssr";
import { env } from "@internal/core";

export function createServerClient(cookies: any) {
  return createSbServer(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies,
  });
}
export function createBrowser() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
```

```ts
// internal/db/index.ts
export { createServerClient, createBrowser as createBrowserClient } from "./client";
export * as Q from "./queries"; // group query fns here
```

---

## Env handling (single source of truth)

```ts
// internal/core/index.ts
function requireEnv(name: string, val: string | undefined) {
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export const env = {
  NODE_ENV: requireEnv("NODE_ENV", process.env.NODE_ENV),
  NEXT_PUBLIC_SUPABASE_URL: requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  STRIPE_SECRET: process.env.STRIPE_SECRET ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
} as const;
```

> All other modules **accept values** (e.g., URLs, IDs) as parameters when needed, rather than reading `process.env` directly.

---

## Extraction recipe (when you add a 2nd site)

1. **Create monorepo** with pnpm workspaces:
   - `/packages/*` (for internal modules), `/apps/*` (one per site).
2. **Move** each `/internal/<name>` to `/packages/<name>`.
3. **Add** minimal `package.json` and build step (e.g., `tsup`) per package.
4. **Replace** imports: `@internal/<name>` → `@acme/<name>` (single search‑replace).
5. **Next.js** temporary support while source is TS:
   ```js
   // next.config.js
   module.exports = {
     experimental: {
       transpilePackages: [
         "@acme/core",
         "@acme/db",
         "@acme/billing",
         "@acme/i18n",
         "@acme/seo",
         "@acme/analytics",
         "@acme/ui",
       ],
     },
   };
   ```
6. **Env split** per app, keep package APIs identical to avoid refactors.
7. **Stripe**: keep price `lookup_key` including app prefix (e.g., `app:web-lingo:pro`).

---

## What to build now (MVP order)

1. `@internal/core` (env), `@internal/db`, `@internal/billing`, `@internal/i18n`.
2. `@internal/ui` (just the components you actually use).
3. `@internal/seo` minimal meta helpers (sitemap/robots later).
4. `@internal/analytics` wrapper with no‑op default.

---

## Done‑is‑done checks (before shipping)

- [ ] Only import from **barrels** (`@internal/*`), no deep paths.
- [ ] No server‑only code imported into client routes/components.
- [ ] All config reads come from `@internal/core`.
- [ ] `internal/db/queries/*` only accessed via `Q.*` re‑exports.
- [ ] ESLint rule blocks deep `@internal/*/*` imports.
- [ ] CI passes type‑check and a smoke test (login → checkout → callback).
- [ ] A sample migration + seed runs via scripts in `/scripts`.
- [ ] Readme documents extraction steps in 10 lines or less.

---

## Example usage in app code

```ts
import { t, setLocale } from "@internal/i18n";
import { createCheckout, PLANS } from "@internal/billing";
import { createServerClient } from "@internal/db";
```
