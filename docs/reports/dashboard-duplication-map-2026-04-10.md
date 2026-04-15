# Dashboard Duplication Map

Scope: customer-facing paths only in `app/dashboard`, `internal/dashboard`, and `components/dashboard`.

Goal: identify duplicated actions, alternate routes to the same outcome, and places where the same data is shown multiple times in different forms, while separating true UX duplication from intentional role- or contract-driven branching.

## Executive summary

The dashboard is functionally split into too many overlapping surfaces:

- Site discovery exists in both the dashboard home and the sites index.
- Site management is split between the site root, `admin`, `pages`, `consistency`, and `overrides`.
- Workspace switching exists in the sidebar and again as per-page action forms.
- The same site state is repeated in the site header, the configuration card, the localization card, and the serving table.
- Several mutation actions have multiple entry points for the same end result.

The simplest UI would reduce this to:

1. One home screen with one primary CTA.
2. One sites index with one list action.
3. One site overview.
4. One settings page.
5. One translation controls page for glossary/overrides/consistency.
6. One pages/crawl page.

Important caveat:

- Some apparent duplication is structural and should not be flattened blindly.
- Customer, agency, and internal-ops users do not share the same auth scope or mutation rights.
- Several pages are intentionally separate read models because the backend returns different payload shapes for list, detail, pages, and admin surfaces.

## Highest-value duplication clusters

### 1. Site creation is exposed in too many places

Same outcome: get to `/dashboard/sites/new`.

- Dashboard home shows both `Start onboarding` and `Add a site` states, depending on onboarding and entitlement conditions. See [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx#L62-L79) and [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx#L114-L150).
- The empty-state card on the home page repeats the same onboarding path and the pricing fallback. See [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx#L187-L213).
- The sites index repeats the same `Add a site` / billing fallback logic. See [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx#L43-L81) and [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx#L90-L105).
- The `SitesList` component adds a `Manage` button, so the user can either enter a site from the list or from the site nav/header once already inside it. See [app/dashboard/\_components/sites-list.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/sites-list.tsx#L21-L29).

Suggestion:

- Keep one primary onboarding CTA on the home page.
- Make the sites index purely the inventory view.
- Use a single copy string for the entitlement/billing fallback.

### 2. Workspace switching is duplicated

Same outcome: change `subjectAccountId` via `setWorkspaceAction`.

- The sidebar has a `WorkspaceSwitcher` form. See [app/dashboard/\_components/workspace-switcher.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/workspace-switcher.tsx#L13-L46).
- The agency overview has a per-customer `View sites` form that does the same workspace switch. See [app/dashboard/agency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/page.tsx#L75-L81).
- The agency customers page repeats the same `View sites` pattern after the plan editor. See [app/dashboard/agency/customers/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/customers/page.tsx#L146-L161).
- The implementation is the same server action and cookie flip. See [app/dashboard/\_lib/workspace-actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_lib/workspace-actions.ts#L1-L44).

Suggestion:

- Keep the sidebar switcher as the only workspace selector.
- Replace per-row `View sites` forms with links into the already selected workspace, or one explicit `Switch` affordance per customer row only if needed.
- Remove the duplicated hidden-form redirect pattern.

### 3. Site identity is shown in three different ways on site pages

Same data repeated:

- `site.sourceUrl`
- `site.status`
- verified domain count
- language coverage

Evidence:

- The site header shows the source URL, active/inactive badge, and verified domain count. See [app/dashboard/sites/[id]/site-header.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/site-header.tsx#L41-L82).
- The site root page repeats source URL, languages, route pattern, domains, next crawl, and profile in the `Configuration` card. See [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L162-L186).
- The site settings page repeats the same source URL and language/routing model in the `Site basics & routing` section. See [app/dashboard/sites/[id]/admin/site-admin-form.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/site-admin-form.tsx#L309-L513).
- The site index repeats source URL, status, languages, and serving mode again in the card list. See [app/dashboard/\_components/sites-list.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_components/sites-list.tsx#L11-L43).

Suggestion:

- Make the site root page the single place where identity and status are summarized.
- Move all edit controls out of the root page into settings.
- Keep the sites index at inventory-level only: title, status, and one manage link.

### 4. Site status / localization toggles are split across multiple screens

Same end result: activate or pause a site.

- The site header offers a status toggle button, and it can appear both inline and in the header actions area. See [app/dashboard/sites/[id]/site-header.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/site-header.tsx#L46-L95).
- That uses `updateSiteStatusAction`, which revalidates the dashboard, sites index, and site page. See [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L1440-L1473).
- The admin/settings page has a second pair of `Pause localization` / `Enable localization` controls, driven by `deactivateSiteAction` and `activateSiteAction`. See [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx#L429-L513).
- The same page also exposes per-locale serving toggles and a `Start serving` / `Enable localization first` / `Verify a domain` decision tree. See [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx#L516-L777).
- The root site page also exposes a `Start serving` path and a live-site link, so serving appears in multiple places with different wording. See [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L189-L206) and [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L502-L655) if you need the serving/domain actions.
- The page-level `translateAndServeAction` is another route to the same net outcome: activate the site if needed, then translate and serve a locale. See [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L744-L787).

Suggestion:

- Collapse all site activation language into one term: `Activate site` or `Pause site`.
- Keep serving-specific actions only on the pages screen.
- Do not surface both site-level activation and locale-level serving decisions on the same screen unless the user is clearly in an advanced mode.

### 5. Domain verification and serving state are repeated on multiple site screens

Same data:

- verified domains
- domain status
- serving status
- crawl readiness

Evidence:

- The site root page shows domain verification, external domain actions, and serving-related actions. See [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L189-L206) and [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L303-L355).
- The admin page repeats the same verified-domain state in its `Localization` and `Serving` cards, then again in the per-locale serving table. See [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx#L429-L596) and [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx#L597-L777).
- The `translateAndServeAction`, `triggerCrawlAction`, `setLocaleServingAction`, `verifyDomainAction`, `provisionDomainAction`, and `refreshDomainAction` all lead to similar user-visible progress around publish/serve readiness, but they are presented as separate routes. See [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L619-L650), [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L744-L787), and [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L1100-L1234), [app/dashboard/actions.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/actions.ts#L1476-L1511).

Suggestion:

- Choose one screen to answer, “Is this site ready to serve?”
- Keep the rest of the screens focused on either setup or operational drill-down, not both.

### 6. Pages/crawl data is shown in several forms

Same data, different presentation:

- crawl summary
- pages summary
- serving table
- per-page crawl queue

Evidence:

- The pages screen shows crawl summary, pages summary, serving rows, and the page list in one route. See [app/dashboard/sites/[id]/pages/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/pages/page.tsx#L224-L491).
- The shared `PagesSummaryBlock` repeats `last crawl started`, `last crawl finished`, `pages updated`, `pages pending`, and remaining quota as five independent stats. See [components/dashboard/pages-summary-block.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/components/dashboard/pages-summary-block.tsx#L19-L43).
- The shared `DeploymentHistoryTable` repeats locale, deployment ID, status, activated, created, and route in a second tabular format. See [components/dashboard/deployment-history-table.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/components/dashboard/deployment-history-table.tsx#L18-L66).
- The `DeploymentCompletenessBadge` is another status-only summary for the same coverage data. See [components/dashboard/deployment-completeness-badge.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/components/dashboard/deployment-completeness-badge.tsx#L8-L27).

Suggestion:

- Keep the pages route as the operational drill-down.
- Put only one compact summary block above the table.
- Avoid showing both coverage badges and history tables unless the user explicitly asks for history.

### 7. Translation controls are fragmented into multiple routes that describe overlapping concepts

Same mental model:

- glossary
- canonical phrases
- override hygiene
- manual overrides
- localized slugs

Evidence:

- The `overrides` route splits the space into `Glossary`, `Manual overrides`, and `Localized slugs`. See [app/dashboard/sites/[id]/overrides/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx#L137-L207).
- The glossary editor itself is a dense second screen for the same terminology data. See [app/dashboard/sites/[id]/glossary-editor.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/glossary-editor.tsx#L14-L76).
- The consistency route adds `Canonical phrases`, `Consistency blocks`, and `Override hygiene warnings`, which is conceptually adjacent to glossary/override management. See [app/dashboard/sites/[id]/consistency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx#L193-L259).
- The actual canonical phrase / block editors are separate row-level controls inside the manager. See [app/dashboard/sites/[id]/consistency/consistency-manager.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/consistency-manager.tsx#L1-L210).
- The two simple forms in `translation-forms.tsx` are already the minimum useful split for manual override and slug editing. See [app/dashboard/sites/[id]/translation-forms.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/translation-forms.tsx#L15-L173).

Suggestion:

- Merge glossary, overrides, consistency, and slugs into a single `Translation rules` area with tabs or accordions.
- Order by frequency of use, not by backend model.
- Keep one explicit label for each concept and avoid multiple near-synonyms on the same screen.

## Role and gating reality check

The duplication story is different by scenario:

- Normal customers mostly suffer from repeated site status, repeated lifecycle controls, and too many overlapping "where do I start?" entry points.
- Agency users inherit the same customer dashboard plus a second workspace-switching model and a customer-management plane.
- Internal ops adds a separate inventory/admin plane with its own account and showcase tools.

What this means for simplification:

- Flatten customer navigation aggressively.
- Do not flatten agency and internal ops into the customer surface.
- Reduce the number of places where the same action can be triggered, but preserve the distinct permission scopes behind the actions.

Feature flags make the UI even harder to scan:

- The dashboard mixes plan, status, quota, capability, preview, and internal-ops gates.
- Some locked cards are valid because they point at different missing capabilities.
- The user still sees a fragmented UX because the gating model is expressed as multiple local decisions instead of one coherent "what can I do here?" model.

The real target should be fewer screens and fewer canonical actions, not fewer backend distinctions.

## Scenario-specific notes

### Normal customer

- The customer path is currently split between home, sites index, site root, site settings, pages, and overrides.
- The site root is doing too much: it is partly overview, partly status control, partly domain readiness.
- The pages route is already the most operationally dense screen, so it should become the single place for crawl and serving details.

### Agency

- Agency navigation duplicates workspace switching in the sidebar and inline `View sites` forms.
- The agency overview and customer list both expose plan/status/site-count summaries for the same accounts.
- The cleanest agency flow is: switch workspace once, then go to the same sites experience as a normal customer.

### Admin / elevated feature flags

- Elevated access adds more branches instead of more clarity.
- On the site settings page, feature flags expose multiple locked and unlocked sections in one long form.
- On the pages screen, internal demo refresh and page-crawl controls add another advanced branch.
- On the consistency and overrides screens, `canEdit` and feature flags create separate locked cards, which compounds the navigation problem because each section has its own on/off copy.

### Cross-role summary

- Customers need one clear path from overview to site detail to site settings to pages.
- Agency users need one workspace switcher and one customer-management route, not multiple inline switch affordances.
- Internal ops should be a detached inventory/admin area, because it answers a different question and uses different permissions.

## What I would simplify first

1. Remove the duplicate site status control from the site root or from settings, but not both.
2. Collapse site management into one settings page and one operational pages page.
3. Replace the current site nav sub-tree with a flatter two-item model: `Overview`, `Settings`, `Pages`, `Translation rules`.
4. Keep one workspace switcher in the chrome and delete inline workspace jump buttons.
5. Collapse glossary / overrides / consistency into one route.

## Recommended report interpretation

Use this report as a simplification map, not as a permission-boundary map.

- Safe simplifications are the ones that reduce repeated labels, repeated status blocks, and duplicate entry points.
- Unsafe simplifications are the ones that merge different roles, collapse separate payload contracts, or hide distinct operational states behind a single status or single page.

## Feature-flag and locked-state UX analysis

This section focuses on the user-facing gate model: entitlements, locked feature cards, onboarding/no-account, and the admin/ops gated surfaces.

### 1. Major gates and their user-visible copy

| Gate                           | User-visible copy                                                                                                                                                                                                                                                                                                                                                                                                                                  | Where it appears                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No dashboard account           | `No dashboard account linked yet`, `Claim free dashboard access`, `Create free dashboard access`, `View pricing page`                                                                                                                                                                                                                                                                                                                              | [app/dashboard/no-account/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/page.tsx)                                                                                                                                                                                                                                                                                           |
| Claiming the account           | `Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.`                                                                                                                                                                                                                                                                                                                                           | [internal/dashboard/onboarding-state.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/onboarding-state.ts)                                                                                                                                                                                                                                                                                 |
| New-site gate                  | `Billing action required`, `Site limit reached`, `Site creation is locked`, `Update billing`, `Upgrade plan`, `Upgrade to add a site`                                                                                                                                                                                                                                                                                                              | [app/dashboard/sites/new/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/new/page.tsx), [app/dashboard/sites/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx), [app/dashboard/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx)                               |
| Site-level localization toggle | `Pause localization`, `Enable localization`, `Pause localization? This won't delete your translations...`, `Activation details`                                                                                                                                                                                                                                                                                                                    | [app/dashboard/sites/[id]/site-header.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/site-header.tsx), [internal/i18n/messages/en.json](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/i18n/messages/en.json)                                                                                                                                    |
| Site settings gate             | `Billing action required`, `Some settings are locked`, `Update billing to resume editing this site.`, `Upgrade your plan to edit locked sections.`, `This setting is locked for your account. Contact support to enable editing.`                                                                                                                                                                                                                  | [app/dashboard/sites/[id]/admin/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx), [internal/i18n/messages/en.json](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/i18n/messages/en.json)                                                                                                                                      |
| Site basics and routing locks  | `Source URL and routing are locked for this account.`, `Locale updates are locked for this account.`, `Serving mode updates are locked for this account.`, `Crawl capture mode is locked for this account.`, `Client runtime settings are locked for this account.`, `Client navigation settings are locked for this account.`, `Attribute translation settings are locked for this account.`, `Site profile updates are locked for this account.` | [internal/dashboard/site-settings.ts](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts)                                                                                                                                                                                                                                                                                       |
| Locked feature cards           | `Glossary`, `Manual overrides`, `Localized slugs`, `Upgrade plan`, `Update billing`, `Locked`, `Billing issue`                                                                                                                                                                                                                                                                                                                                     | [app/dashboard/sites/[id]/locked-feature-card.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/locked-feature-card.tsx), [app/dashboard/sites/[id]/overrides/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx)                                                                                          |
| Consistency gate               | `Consistency governance`, `Upgrade to edit canonical phrases and block policies.`, `Update billing to resume consistency governance edits.`                                                                                                                                                                                                                                                                                                        | [app/dashboard/sites/[id]/consistency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx)                                                                                                                                                                                                                                                                   |
| Customer site ops gate         | `Domains`, `Update billing to resume domain verification and serving.`, `Upgrade to manage domain verification and serving.`, `Translate & serve`, `Provision domain`, `Check DNS`, `Check now`, `Force full website crawl`                                                                                                                                                                                                                        | [app/dashboard/sites/[id]/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx)                                                                                                                                                                                                                                                                                           |
| Internal ops gate              | `Ops`, `Managed accounts`, `Managed demos`, `Internal admin`, `Open account inventory`, `Open managed demos`, `Open preview reviews`                                                                                                                                                                                                                                                                                                               | [app/dashboard/ops/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/page.tsx), [app/dashboard/ops/accounts/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/page.tsx), [app/dashboard/ops/showcases/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/showcases/page.tsx) |
| Agency gate                    | `Agency overview`, `Customers`, `View sites`, `Open workspace`                                                                                                                                                                                                                                                                                                                                                                                     | [app/dashboard/agency/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/page.tsx), [app/dashboard/agency/customers/page.tsx](/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/customers/page.tsx)                                                                                                                                        |

### 2. Where the UI overloads users with too many local on/off decisions

The overload is not just the number of gates. It is the number of separate local choices that all read like the same question.

#### High-overload areas

- `app/dashboard/sites/[id]/admin/site-admin-form.tsx` is the worst offender. It lets the user decide `sourceUrl` edit mode, `subdomainPattern` edit mode, whether to confirm a URL reset, serving mode, crawl capture mode, client runtime, SPA refresh, SPA refresh fallback strategy, SPA section scope, translatable attributes, and advanced brand/profile notes. Several of those choices are themselves conditionally disabled by other choices.
- `app/dashboard/sites/[id]/admin/page.tsx` duplicates the same theme at a higher level by mixing site activation, serving, domains, deployment history, showcase controls, and a global locked-state banner on one screen.
- `app/dashboard/sites/[id]/overrides/page.tsx` splits one conceptual job into three separate lock states, each with its own CTA and badge text.
- `app/dashboard/sites/[id]/consistency/page.tsx` adds another parallel lock card for a concept that users likely perceive as part of the same translation-rules job.
- `app/dashboard/no-account/page.tsx` and `app/dashboard/sites/new/page.tsx` both explain what to do next, but they do it with different frames: claim, pricing, onboarding, upgrade, billing, and free access.
- `app/dashboard/layout.tsx` exposes plan, status, crawl quotas, acting-as context, and workspace switching together in the persistent shell. That is correct information, but it is too many concepts to ask the user to parse on every screen.

#### Pattern that causes the overload

The same status question is repeatedly recast as:

- `Is this site active?`
- `Can I edit this section?`
- `Is billing blocking me?`
- `Do I need to upgrade?`
- `Is this a feature I can enable?`
- `Do I need to switch workspace first?`

The UI answers each one locally, instead of first teaching the user one stable model for the page they are on.

### 3. Simpler explanation model for locked features

The current model is capability-first and feature-flag-first. That is precise, but it is not simple.

The simpler user model should be:

1. `This site is editable or locked.`
2. `If editable, these are the tasks you can do here.`
3. `If locked, one reason explains it, and one action resolves it.`

That means:

- Use one generic explanation for most customer locks: `Editing is unavailable for this account.`
- Show one primary action only: `Update billing` or `Upgrade plan`.
- Reserve section-level detail for the section itself, not for the top of the page.
- Treat capability names as implementation detail. The user should see `Edit site settings`, `Manage translation rules`, `Verify domains`, `Operate translations`, not `client_runtime_toggle` or `crawl_capture_mode`.
- When a page has multiple locked sections, label the page once as `Partially locked` and let each section explain what it controls.

Recommended copy model:

- Top-level banner: `Editing is unavailable for this account. Update billing to unlock site changes.`
- Section-level note: `This section is part of site settings.` or `This section is part of translation rules.`
- Disabled state tooltip: `Locked for this account.`
- CTA: always `Update billing` when billing is the blocker, otherwise `Upgrade plan` or `Request access` only if there is a true non-billing entitlement path.

### 4. Group by task or by capability?

For the dashboard UI, group by task.

Reason:

- Users are not thinking in backend capability names.
- The current capability split produces many near-identical sections with different lock messages.
- Task grouping matches the natural workflow: set up the site, verify domains, operate translations, manage rules, inspect history.

Where capability grouping still makes sense:

- In the backend and in internal admin surfaces.
- In developer or ops tools where the operator is explicitly managing the policy model.
- In locked cards when a single missing capability is the whole point of the screen.

Practical rule:

- Customer dashboard: group by task.
- Admin/ops policy surfaces: group by capability only when the user is explicitly editing policy.

### 5. Ranked simplification backlog

1. Collapse the site settings form into a single `Site settings` page with clear subsections and only one lock explanation at the page level.
2. Merge glossary, manual overrides, consistency, and slug editing into one `Translation rules` area with tabs or sections ordered by task frequency.
3. Reduce the site detail page to one operational overview plus a single path to deeper setup, so it stops competing with the settings page.
4. Remove one of the two site activation affordances and standardize the remaining label to `Pause localization` / `Enable localization`.
5. Flatten the site navigation to `Overview`, `Site settings`, `Pages`, `Translation rules`, and `Support` only.
6. Keep the pages route as the only place where row-level crawl/translate actions live.
7. Replace multiple CTA variants like `Upgrade to manage`, `Upgrade to edit`, `Upgrade to customize`, `Upgrade to unlock` with a smaller vocabulary anchored on the page task.
8. Keep agency and internal ops separate, but reduce repeated `View sites` / `Open workspace` forms to one canonical workspace-switch affordance per role.

### 6. Proposed simpler IA

#### Customer IA

- `Overview`
- `Sites`
- `Site settings`
- `Pages`
- `Translation rules`
- `Support`

#### Inside a site

- `Overview`
- `Settings`
- `Pages`
- `Translation rules`

#### Agency IA

- `Agency overview`
- `Customers`

#### Internal ops IA

- `Ops home`
- `Managed accounts`
- `Managed demos`
- `Preview reviews`

### 7. What should not be simplified away

- The actor/subject account split.
- Separate site, domain, deployment, and translation-run states.
- Internal ops as a detached inventory/admin plane.
- Capability-specific server-side enforcement.
- Summary vs paginated detail payloads.

### 8. Short conclusion

The UI should not become less capable. It should become less interpretive.

The simplification target is:

- one explanation per page,
- one primary task per route,
- one lock reason per section,
- one canonical path to upgrade or unlock,
- and fewer screens where the same state is re-described with slightly different labels.
