# Recommended Structure for Single Website (Package-Ready)

## Directory Layout

```
/app
/components
/internal
  /core
  /billing
  /auth        (future)
  /db          (future)
  /i18n        (future)
  /seo         (future)
  /analytics   (future)
  /ui          (future)
/modules
  /pricing
/styles
public/
next.config.mjs
package.json
tsconfig.json
```

## Principles

- **One app today**, organised as proto-packages under `internal/` so they can move to `/packages/*` later.
- Each folder exposes a single entry point (`index.ts`) when more than one file exists.
- Avoid deep imports between subfolders; rely on path aliases.
- Keep server/client components separate and limit side effects.

## Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@internal/*": ["./internal/*"],
      "@modules/*": ["./modules/*"],
      "@components/*": ["./components/*"],
      "@/*": ["./*"]
    }
  }
}
```

## Example Internal Modules

- `internal/core` — Environment parsing, logger, cross-cutting utilities.
- `internal/billing` — Stripe client, plan resolution, webhook helpers.
- `internal/auth` (future) — Authentication clients/wrappers.
- `internal/db` (future) — Database connectors and queries.
- `internal/i18n`, `internal/seo`, `internal/analytics`, `internal/ui` — Add as features demand them.

## Extraction Path (When Adding More Sites)

1. Create `/packages/<name>` and move each `internal/<module>` into its package.
2. Add `package.json` + build tooling (tsup, swc, etc.) for each package.
3. Replace `@internal/*` aliases with package names (e.g., `@acme/core`).
4. Use Next.js `transpilePackages` to consume the packages from other apps.
5. Keep APIs identical during extraction to avoid refactors.

## Development Order

1. Core, Billing, and any other cross-cutting modules required for the MVP.
2. Feature modules under `modules/` (pricing, dashboard, etc.).
3. UI primitives as needed—extract to `internal/ui` only when reuse justifies it.

## Best Practices

- Only import via the public surface (`index.ts`) of each module.
- Keep a single `env` reader (`internal/core/env.ts`).
- Add ESLint rules to block deep internal imports when extraction nears.
- Write lightweight tests around modules with meaningful logic.

## Extraction Checklist

- [ ] Module exports defined in a single `index.ts`.
- [ ] No circular dependencies between modules.
- [ ] All code uses aliases (no relative deep imports).
- [ ] `internal/core/env.ts` is the only place reading from `process.env`.
- [ ] TypeScript path aliases can be replaced with package names without cascading changes.

## Example Import

```ts
import { createCheckoutSession } from "@internal/billing";
import { env } from "@internal/core/env";
import { pricingTiers } from "@modules/pricing/data";
```

This structure ships quickly now and scales cleanly when you spin up additional SaaS websites.
