# Dashboard Flows and Use Cases

Purpose: describe the user journeys and UX expectations for the customer dashboard, with a clear split between normal customers and agency users. This doc complements `docs/backend/DASHBOARD_SPECS.md` (API contracts) and `docs/dashboard-milestone-plan.md` (delivery plan).

## Personas

- Normal customer: owns a single account and manages only their own sites.
- Agency admin: manages their own agency account plus multiple customer accounts.
- Agency-managed customer: a standard customer account that is managed by an agency (same UI as normal customer, but accessed via agency context).

## Core flows (normal customer)

1. Sign in (Supabase Auth) and exchange for a webhooks JWT.
2. Load `/accounts/me` to resolve plan status, feature flags, and quotas.
3. Overview shows active sites, domain status, and usage vs limits.
4. Create site via onboarding:
   - Source URL + source language.
   - Target languages (respect locale cap).
   - Subdomain pattern.
   - Site profile (brand voice).
5. Verify domains (DNS instructions, then verify/provision/refresh).
6. Trigger crawl to refresh translations.
7. Manage translations per site:
   - Glossary, overrides, and slugs (if enabled by plan).
8. Monitor deployments per locale.
9. Pause/resume translations for a site.

## Core flows (agency admin)

1. Sign in and enter agency workspace (actor = agency account).
2. Agency overview:
   - Usage badge: total active sites vs maxSites.
   - Customer list (plan, status, active site count).
3. Filter customers by plan/status/usage.
4. Create customer (invite flow) and pick plan.
5. Switch context into a customer workspace.
6. Manage customer sites using the same UI as a normal customer.
7. Switch back to agency workspace for global metrics.

## Current state (weblingo_website)

The current dashboard is implemented in `app/dashboard` and uses the webhooks worker API.

- Auth + entitlements: `internal/dashboard/auth.ts` exchanges Supabase tokens for a webhooks JWT and fetches `/accounts/me`.
- Navigation: Overview, Sites, Developer tools; agencies also see Agency overview + Customers (`app/dashboard/layout.tsx`).
- Overview: summary cards for active sites, unverified domains, and configured locales (`app/dashboard/page.tsx`).
- Sites list: list + summary per site; plan + usage badges live in the shared header (`app/dashboard/sites/page.tsx`).
- Site detail: domains, deployments, trigger crawl, glossary, overrides, slugs (`app/dashboard/sites/[id]/page.tsx`).
- Feature gating: locked sections show disabled cards with upgrade CTAs instead of disappearing.
- Onboarding: uses `maxLocales` from `/accounts/me` and blocks adding targets past the cap (`app/dashboard/sites/new/onboarding-form.tsx`).
- Domain onboarding: handles CNAME instructions (provision/refresh) or TXT verification (`app/dashboard/sites/[id]/page.tsx`).
- Agency surface: workspace switcher + agency overview/customers list (with filters and invite flow).
- Auth refresh policy: dashboard exchanges Supabase tokens for webhooks JWTs server-side on each request, refreshes pre-expiry (5-minute buffer), and retries once on 401.
- Billing policy: mutations require both actor and subject plans to be active; billing banners warn the billing owner (agency when acting as agency, customer when in own workspace) without showing agency billing warnings to customer workspaces.

## Recommended UX (future)

### Shared principles

- Show plan status + usage badge on every page (top bar).
- Do not hide locked features. Disable them with a short explanation and an upgrade CTA.
- Keep actions allowed by the server; rely on 403 responses for enforcement and provide the upgrade CTA where relevant.
- If `planStatus` is not active, show a billing banner and disable mutation actions even if the feature is otherwise enabled. Agency billing warnings stay on agency-owned views to avoid confusing managed customers.

### Normal customers

- Overview: show usage vs maxSites, plan status, and a clear CTA to add a site.
- Sites list: include per-site locale count and a badge if the site is at its locale cap.
- Site detail: show glossary/overrides/slug sections even when locked, but disabled with a CTA ("Upgrade to Pro to unlock manual overrides").
- Onboarding: surface maxLocales as a plan limit and show a CTA when the user hits it.

### Agencies

- Add a dedicated "Agency overview" page:
  - Usage badge from `/agency/customers` summary (includes agency-owned + managed customer sites).
  - Customers table with plan, status, active site count, and filter controls.
  - Treat `maxSites: null` as “Unlimited” in the usage badge.
- Add a workspace switcher in the header:
  - "My agency" and each customer account.
  - Show "Acting as Customer X" when the subject account is not the agency.
- Add a "Customers" page:
  - Create customer (invite) flow.
  - Per-customer detail page (plan, status, sites list).
- Sites list:
  - For agencies, show "My agency sites" in agency context.
  - For customers, show the same list as normal customers.
- Optional future page: "All managed sites" across customers (would need a backend aggregate endpoint).

### IA map (navigation + routes)

Normal customers:

- `/dashboard` — Overview (usage badge, recent status).
- `/dashboard/sites` — Sites list.
- `/dashboard/sites/new` — Onboarding (only if `site_create` enabled).
- `/dashboard/sites/:id` — Site detail (domains, deployments, glossary, overrides, slugs).
- `/dashboard/developer-tools` — Tokens/config.
- `/dashboard/no-account` — Plan selection + account claim.

Agency admins (in agency context):

- `/dashboard/agency` — Agency overview (usage badge, quick stats).
- `/dashboard/agency/customers` — Customer list + filters + invite.
- `/dashboard/agency/customers/:id` — Customer detail (plan, status, sites list).
- `/dashboard/sites` — Agency-owned sites (same component as normal customers).
- `/dashboard/sites/new` — Create agency-owned site (when allowed).
- `/dashboard/developer-tools` — Tokens/config.

Workspace switcher (header):

- Options: "My agency" + each customer account.
- Switching uses `POST /auth/token` with `subjectAccountId`.
- Show a persistent "Acting as Customer X" banner when subject != actor.

### Upgrade CTA patterns

- Use inline locked cards with a disabled state and a CTA button:
  - "Unlock glossary management" -> Pricing/upgrade.
  - "Unlock manual overrides" -> Pricing/upgrade.
  - "Unlock slug editor" -> Pricing/upgrade.
- Keep placeholders visible to educate the user about what they gain when upgrading.

## Data dependencies (for implementation)

- `/accounts/me`: plan status, feature flags, quotas for the current subject account.
- `/sites`: list sites for the current subject account.
- `/agency/customers`: agency list and summary (plan status + active site counts + totals).
- `/auth/token` with `subjectAccountId` for agency context switching.
