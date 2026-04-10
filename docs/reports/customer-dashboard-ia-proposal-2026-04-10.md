# Customer Dashboard IA Proposal

Scope: customer-facing dashboard only.

This report intentionally excludes agency and internal-ops surfaces. Those are real role-separated planes and should not be collapsed into the customer IA.

## What I audited

- [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx)
- [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx)
- [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx)
- [app/dashboard/sites/[id]/pages/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/pages/page.tsx)
- [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx)
- [app/dashboard/sites/[id]/overrides/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx)
- [app/dashboard/sites/[id]/consistency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx)
- [app/dashboard/_components/sites-nav.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/sites-nav.tsx)
- [internal/dashboard/site-settings.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts)
- [internal/dashboard/entitlements.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/entitlements.ts)

I also exercised the customer dashboard in the browser in mock-auth mode. That covered the overview, sites list, site detail, pages, settings, overrides, consistency, developer-tools, and no-account flows. The mock path does not expose agency or internal-ops branches, so the role-specific conclusions below are code-driven.

## Executive Read

The customer dashboard has too many entry points for the same mental model:

- site selection exists in both the home view and the sites list
- site status appears in the shell, site header, site detail, and settings
- crawl/translate appears in site detail, pages, settings, and sometimes the same status is repeated in multiple cards
- translation governance is split across overrides, consistency, glossary, and slug editing
- site settings and site operations are separated into different screens, but the content is still conceptually one site workspace

The smallest sensible customer IA is not "fewer links everywhere". It is "fewer canonical screens, each with one owner".

## 1. Ranked List Of Screens That Should Remain

1. `Dashboard Home / Sites Index`
   - Keep one obvious entry point for all sites and onboarding.
   - The current duplication between [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx) and [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx) should collapse to a single canonical "home" screen.
   - This screen owns: site switching, add-site CTA, onboarding state, and pricing/billing fallback.

2. `Site Workspace`
   - This is the most important customer screen because it is where a user first asks: "What is the state of this site right now?"
   - Keep the site identity, localization status, domain status, serving readiness, and primary actions here.
   - The current [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx) is already the best base for this.

3. `Site Settings`
   - Preserve one durable configuration screen for source URL, locales, routing, serving mode, crawl capture mode, client runtime, SPA refresh, translatable attributes, and profile metadata.
   - [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx) is too broad today, but the underlying screen category is still necessary.

4. `Translation Rules`
   - Keep one screen for glossary, manual overrides, localized slugs, and consistency policy.
   - The user mental model is "translation governance", not four separate pages.
   - This should unify [app/dashboard/sites/[id]/overrides/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx) and [app/dashboard/sites/[id]/consistency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx).

5. `Pages / Crawl Detail`
   - If you keep it as a screen, it should be a secondary operational view, not a top-level sibling of the site workspace.
   - If you want the narrowest IA, demote this into a section or internal tab inside the site workspace instead of a standalone route.
   - This screen currently owns crawl summaries, page tables, serving-by-language status, pagination, and page-level crawl actions in [app/dashboard/sites/[id]/pages/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/pages/page.tsx).

## 2. Screens To Merge Or Demote

1. Merge `[Dashboard Home]` and `[Sites Index]`
   - Keep one canonical landing screen.
   - The other route should become a redirect or alias, not a distinct primary destination.
   - Right now both screens present the same core jobs: create a site, review sites, and go to a site.

2. Merge `[Overrides]` and `[Consistency]`
   - These are both translation-governance surfaces.
   - They should share one screen with sections or tabs, not two route-level destinations.
   - The current split makes the rule model harder to explain than it needs to be.

3. Merge `[Admin]` into `[Site Settings]`
   - The current admin page is a catch-all for settings, serving, deployment history, localization, and elevated controls.
   - Customers should not have to guess whether a control belongs in "admin" or "settings".
   - The better shape is one settings screen with a clear section order: basics, locales, serving, runtime, deployment/history, and advanced controls.

4. Demote `[Pages]` to a section or tab inside `[Site Workspace]`
   - The pages view repeats the same site header and serving/domain context that already exists elsewhere.
   - It is valuable, but it does not need to be a peer screen in the main navigation.
   - The page table and crawl details should live under one operational "Pages & crawl" subsection.

5. Demote duplicate status controls
   - `Pause localization`, `Enable localization`, `Start serving`, and `Translate & serve` appear in multiple places today.
   - Pick one canonical home for each action class and link to it from everywhere else.

## 3. Narrowest Canonical IA That Still Preserves Coverage

If I optimize for the smallest screen model that still preserves all customer features, I would use this:

1. `Dashboard`
   - Site list
   - Add site
   - Onboarding / billing gating

2. `Site`
   - Site summary
   - Domain verification / provisioning
   - Localization activation
   - Primary translate-and-serve actions
   - High-level automation and notifications

3. `Site Settings`
   - Source URL
   - Locale management
   - Routing
   - Serving mode
   - Crawl capture mode
   - Client runtime / SPA refresh
   - Translatable attributes
   - Profile metadata
   - Deployment history and serving configuration if you want to keep them visible here

4. `Translation Rules`
   - Glossary
   - Manual overrides
   - Localized slugs
   - Consistency governance
   - Locale-specific policy selector

5. `Pages & Crawl` as an internal subsection of `Site`
   - Crawl summary
   - Pages summary
   - Page table
   - Serving-by-language table
   - Page-level crawl actions

That is the narrowest model I would recommend without hiding customer features behind too much scrolling or too many nested sections.

If you want an even tighter IA, I would not remove `Pages & Crawl` entirely. I would fold it into `Site` as a tab or anchor section.

## 4. Customer UX Simplification Traps To Avoid

1. Do not collapse different status domains into one generic badge.
   - `site.status`, domain verification, serving readiness, deployment status, and translation-run status are different things.
   - Users need all of them, but not all at once in every screen.

2. Do not turn entitlement gating into the navigation model.
   - Feature flags should decide whether a section is editable, not whether the user can understand where the section lives.
   - The current entitlement matrix in [internal/dashboard/entitlements.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/entitlements.ts) and [internal/dashboard/site-settings.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts) is fine as backend policy, but it is the wrong abstraction for the IA.

3. Do not keep two primary routes for the same list view.
   - `Overview` and `Sites` should not both feel like canonical home.
   - Pick one and demote the other to a redirect or a secondary alias.

4. Do not scatter the same action across three screens.
   - If "translate", "crawl", or "toggle serving" lives in site summary, pages, and settings, users will not know which place is authoritative.

5. Do not leave the current site nav as five peer items.
   - `Configuration`, `Pages`, `Consistency`, `Overrides`, `Admin` is too close to the underlying implementation, not the user mental model.
   - The nav should be closer to `Summary`, `Pages`, `Settings`, `Rules`.

6. Do not make locale scope invisible.
   - The current consistency page is already showing that a locale selector is required.
   - If this gets merged into one rules screen, keep the selected locale visible and sticky.

7. Do not mix customer actions with internal-ops recovery or demo tooling.
   - The customer IA should not inherit internal-only cards or policy shortcuts just because they live on the same site entity.

## Suggested Next Step

If you want the least confusing implementation shape, I would redraw the customer nav as:

- `Home`
- `Site`
- `Settings`
- `Rules`

Then treat pages/crawl as a subsection within `Site`, not a separate top-level route.
