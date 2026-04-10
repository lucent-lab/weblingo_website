# Dashboard Simplification Risk Review

Date: 2026-04-10

Goal: stress-test the simplification hypothesis for the WebLingo website dashboard. This report focuses on where duplication and branching are deliberate, contract-driven, or required by role separation.

## What I validated

- Read the dashboard auth, entitlement, workspace switching, and site-setting code paths.
- Read the dashboard UI routes for customer, agency, and internal admin surfaces.
- Checked the webhooks worker contract schemas that drive the dashboard payload shapes.
- Ran targeted tests:
  - `internal/dashboard/auth.test.ts`
  - `internal/dashboard/site-settings.test.ts`
  - `internal/dashboard/data.test.ts`
- Exercised the dashboard in mock-auth mode through the live Next app:
  - `/dashboard`
  - `/dashboard/sites/site-smoke-1`
  - `/dashboard/sites/site-smoke-1/pages`
  - `/dashboard/sites/site-smoke-1/admin`
  - `/dashboard/sites/site-smoke-1/consistency`
  - `/dashboard/sites/site-smoke-1/overrides`

## Bottom line

The dashboard does contain repeated data, but most of it is not accidental duplication. The same site/account state is intentionally rendered in different places because:

- the actor/subject/account split is real,
- the backend returns different payload shapes for list, detail, pages, history, and admin surfaces,
- feature flags are not a single yes/no gate,
- several states that look similar in the UI are semantically distinct on the backend.

The biggest simplification risk is collapsing pages that serve different auth scopes or different backend contracts into one generic dashboard surface.

## Where duplication is actually necessary

### 1. Global shell metrics vs per-page details

The top dashboard shell shows plan, billing status, crawl usage, and site totals in the header, while the overview page and site list show site-specific summaries.

- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/_components/sites-list.tsx`

This is not redundant. The shell is persistent navigation context; the page content is task-specific detail. The shell must stay visible during route transitions, especially when switching workspaces.

Why naive simplification is unsafe:

- `app/dashboard/layout.tsx` resolves the current account context through `requireDashboardAuth()` and builds the workspace switcher and billing banner from that state.
- `internal/dashboard/auth.ts` keeps `actorAccount`, `subjectAccount`, `actingAsCustomer`, and `billingIssue` separate.
- `app/dashboard/_lib/workspace-actions.ts` allows switching only to the actor account or active agency-managed customer accounts.

If you collapse the shell metrics into page-only UI, you lose the persistent actor/subject context and make workspace switching harder to reason about.

### 2. Site list, site detail, pages, and admin are different read models

The same site appears in:

- the global site list,
- the site detail page,
- the site pages page,
- the site admin page,
- the consistency page,
- the overrides page.

Relevant files:

- `app/dashboard/_components/sites-list.tsx`
- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/pages/page.tsx`
- `app/dashboard/sites/[id]/admin/page.tsx`
- `app/dashboard/sites/[id]/consistency/page.tsx`
- `app/dashboard/sites/[id]/overrides/page.tsx`

This looks repetitive, but the backend contract intentionally splits the payloads:

- `listSitesResponseSchema` is summary-only.
- `siteSchema` is the full site object.
- `siteDashboardResponseSchema` includes `site`, `deployments`, optional `pagesSummary`, optional `operationalSummary`, optional `pages`, and optional `pagination`.
- `listDeploymentHistoryResponseSchema` is separate again.

Relevant contract code:

- `internal/dashboard/webhooks.ts`
- `internal/dashboard/data.ts`

Why naive simplification is unsafe:

- The site list is summary-only for a reason. It avoids leaking detail fields and keeps the sidebar and overview cheap.
- The site detail route needs deployments and page summaries.
- The pages route needs page rows and pagination.
- The admin route needs the site object plus deployment history, language catalog, and internal-admin-only showcase data.

If you force a single universal "site page", you either overfetch everywhere or start leaking partial state through conditional rendering that the current contract intentionally keeps separate.

### 3. Site status, serving status, and domain verification are distinct states

The UI repeats status in several places, but the meanings are different:

- `site.status` = whether the site is active or inactive.
- `domain.status` / `verifiedAt` / `dnsInstructions` / `cloudflare` = domain verification state.
- `deployment.servingStatus` = whether a locale is ready, serving, needs a domain, disabled, or degraded.
- `deployment.serveEnabled` = locale serving toggle.
- `translationRun.status` = translation job lifecycle.

Relevant files:

- `app/dashboard/sites/[id]/site-header.tsx`
- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/admin/page.tsx`
- `internal/dashboard/webhooks.ts`

Why naive simplification is unsafe:

- The site header shows the coarse site state and the domain count.
- The Domains card shows verification and Cloudflare state.
- The Serving table shows locale-level serving and the actions that are legal for each locale.
- The Deployments table shows deployment identity and history.

Collapsing these into a single "status" chip would erase important operational distinctions and create wrong affordances. For example, a site can be active while one locale is paused, a domain can be verified while serving is still not live, and a translation run can be active while the deployment is still degraded.

### 4. The locked sections are separately gated on purpose

The locked feature patterns on the dashboard are not just cosmetic duplication. They reflect different backend gates.

Relevant files:

- `internal/dashboard/entitlements.ts`
- `internal/dashboard/site-settings.ts`
- `app/dashboard/sites/[id]/overrides/page.tsx`
- `app/dashboard/sites/[id]/consistency/page.tsx`
- `app/dashboard/sites/[id]/admin/site-admin-form.tsx`
- `app/dashboard/sites/[id]/locked-feature-card.tsx`

Why naive simplification is unsafe:

- `deriveSiteSettingsAccess()` splits capabilities into basics, locales, serving mode, crawl capture mode, client runtime, SPA refresh, translatable attributes, and profile editing.
- `buildSiteSettingsUpdatePayload()` enforces the same boundaries on the server-side form parser.
- `Has` in `internal/dashboard/access.tsx` supports `plan`, `status`, `feature`, `preview`, and `quotaWithin` checks, not just one boolean.

This means a single generic "locked" wrapper is too coarse. Each section needs a different explanation and, in some cases, a different CTA.

### 5. Agency, customer, and internal-admin scopes are intentionally separate

The dashboard has three different kinds of operator surfaces:

- agency admin surfaces,
- agency-managed customer surfaces,
- internal admin ops surfaces.

Relevant files:

- `app/dashboard/agency/page.tsx`
- `app/dashboard/agency/customers/page.tsx`
- `app/dashboard/ops/page.tsx`
- `app/dashboard/ops/accounts/[accountId]/page.tsx`
- `app/dashboard/ops/showcases/page.tsx`
- `app/dashboard/layout.tsx`
- `internal/dashboard/auth.ts`
- `app/dashboard/_lib/workspace-actions.ts`

Why naive simplification is unsafe:

- `auth.actorAccount` and `auth.subjectAccount` are not the same thing.
- `setWorkspaceAction()` only allows switching to the actor or active agency-managed customers.
- `hasActorInternalOps()` requires an agency account plus `internalOpsEnabled`.
- Internal admin account editing can override raw feature flags and quotas.
- Agency plan changes are intentionally restricted to `starter` and `pro`.

Trying to flatten agency and internal admin into one "accounts" page would blur who is acting, on whose behalf, and what they are actually allowed to mutate.

### 6. The site admin page is not just a second copy of the site detail page

At a glance, `app/dashboard/sites/[id]/page.tsx` and `app/dashboard/sites/[id]/admin/page.tsx` both show the same site and its deployments. That is intentional, because they serve different questions:

- the detail page answers "what is the site doing right now?"
- the admin page answers "what can I change, and which settings are locked?"

Relevant files:

- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/admin/page.tsx`
- `app/dashboard/sites/[id]/site-header.tsx`

Why naive simplification is unsafe:

- The detail page centers on domains, translate-and-serve, page summaries, translation summaries, and snippet generation.
- The admin page centers on site settings, locale/serving controls, deployment history, and internal-admin-only showcase controls.
- The admin page also needs to render the internal policy card only for internal ops.

If you collapse them, you end up mixing read-only operational status with configuration edits and internal-admin-only controls, which increases the risk of accidental privilege leakage and UI confusion.

## Hidden dependencies that make simplification risky

### A. Cache keys are part of the contract

`internal/dashboard/data.ts` caches:

- the site list by subject account,
- the site dashboard by subject account + site ID + option set,
- supported languages globally.

It also splits cache buckets by whether pages and operational summary are included.

This matters because the UI uses:

- list summary data in the shell and site list,
- detail data on site pages,
- paginated page data on the pages route,
- non-paginated detail data elsewhere.

If you merge these views, you lose the cache boundaries that keep the dashboard responsive and correct.

### B. The `pagesSummary` and `pages` split is purposeful

`siteDashboardResponseSchema` supports `pagesSummary` without `pages`, and optionally `pages` plus `pagination`.

Relevant files:

- `internal/dashboard/webhooks.ts`
- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/pages/page.tsx`

This lets the site detail page show a compact crawl summary while the pages page can request the heavier paginated list. A "single page model" would either overfetch or force awkward conditional rendering.

### C. Some duplicated-looking actions are different operations

Examples:

- "Pause localization" vs "Disable serving" vs "Deactivate domain" are not the same.
- "Translate & serve" vs "Force crawl" vs "Force page crawl" are not the same.
- "Provision domain" vs "Refresh domain" vs "Verify domain" are not the same.

Relevant files:

- `app/dashboard/sites/[id]/site-header.tsx`
- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/pages/page.tsx`
- `app/dashboard/actions.ts`
- `internal/dashboard/webhooks.ts`

The current UI repeats words, but the actions map to different worker endpoints and different state transitions.

## Specific simplification traps to avoid

1. Do not merge the site list, site detail, and admin pages into one giant "site screen". They are separate contracts and privilege levels.
2. Do not replace the header metrics with page-local copies only. The shell context is needed for actor/subject awareness.
3. Do not collapse all feature-gated sections into one generic locked card. The backend gates are capability-specific.
4. Do not turn site status into a single status chip. Site, domain, deployment, and translation states are different.
5. Do not unify agency and internal-admin workspace flows. They use different auth identities and different mutation rights.
6. Do not remove the summary/detail split in `getSiteDashboardCached()`. It is the performance and correctness boundary for the dashboard.

## Counterexamples that justify current duplication

- The live mock dashboard showed the header displaying plan, status, crawl usage, and site counts while the overview page still rendered a site list card. Those are not the same information from the user's perspective.
- The site detail page showed source URL, language mapping, domain verification, translate-and-serve actions, translation summaries, and language switcher snippets. The admin page showed site settings, localization controls, deployment history, and internal policy. These are adjacent, not redundant.
- The pages route showed crawl summary, page summary, row-level crawl actions, and pagination. That cannot be collapsed into the main site detail without losing the page-level task model.

## Recommendation

Do not pursue a broad "simplify the dashboard" refactor by merging routes or deleting repeated status blocks.

Instead:

- simplify wording,
- reduce visual noise,
- group repeated information into clearer sections,
- keep the underlying route and permission boundaries intact,
- preserve the summary/detail payload split.

That gives you a simpler UX without destroying the backend contract and role separation that currently keep the dashboard safe.
