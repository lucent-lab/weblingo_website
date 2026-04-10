# Dashboard Role Boundaries and Simplified IA

Date: 2026-04-10

Scope:
- Auth, entitlements, workspace switching, site settings access, and ops routes.
- Live UI exercised in dashboard mock mode for customer flows.
- Agency and internal-ops behavior verified from code contracts and route guards.

## 1. What Is Truly Separate By Role Or Contract

- Normal customer access is the default dashboard contract. `requireDashboardAuth()` gates signed-in users, then `webhooksAuth` and `account` decide whether the user can do real work or falls back to `/dashboard/no-account`. See [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L422) and [`app/dashboard/no-account/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/page.tsx#L18).
- Customer workspace state is split into actor vs subject. The auth object carries both `actorAccount` and `subjectAccount`, plus `actingAsCustomer`, `subjectFallbackToActor`, and separate `actorWebhooksAuth` / `webhooksAuth`. That is not cosmetic; it is the core workspace contract. See [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L33) and [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L459).
- Agency is a real role boundary. Agency-only pages check `auth.actorAccount?.planType === "agency"` and redirect away if not. See [`app/dashboard/agency/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/page.tsx#L9) and [`app/dashboard/agency/customers/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/customers/page.tsx#L20).
- Internal ops is a separate capability, not a third top-level plan. `hasActorInternalOps()` requires agency plan plus `featureFlags.internalOpsEnabled === true`. See [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L53).
- Internal ops routes are isolated from customer and agency workspaces. `OpsPage`, `OpsAccountsPage`, and `OpsShowcasesPage` all `notFound()` without internal-ops access and use `actorWebhooksAuth` directly. See [`app/dashboard/ops/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/page.tsx#L15), [`app/dashboard/ops/accounts/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/page.tsx#L78), and [`app/dashboard/ops/showcases/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/showcases/page.tsx#L22).
- Site settings are intentionally split into multiple capability buckets. `deriveSiteSettingsAccess()` separates basics, locales, serving mode, crawl capture, client runtime, SPA refresh, translatable attributes, and profile. The update payload rejects each bucket separately. See [`internal/dashboard/site-settings.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts#L68).
- Site action permissions are also split. The customer site page only enables `edit`, `crawl_trigger`, and `domain_verify` combinations where appropriate, while the admin page adds further internal-ops and showcase gating. See [`app/dashboard/sites/[id]/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L48) and [`app/dashboard/sites/[id]/admin/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/page.tsx#L57).
- Site-create onboarding is a separate lifecycle contract. It is blocked by `site_create`, billing, and active-site slots. See [`app/dashboard/sites/new/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/new/page.tsx#L16).
- The public no-account flow is a separate product state. It is only visible when `PUBLIC_PORTAL_MODE=enabled` and starts with account claim before onboarding. See [`app/dashboard/no-account/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/page.tsx#L18).

## 2. What Can Be Unified In The UI Without Changing Permissions

- `Overview` and `Sites` are the same information class. Both are site inventory plus onboarding CTA, and both derive from the same `listSitesCached()` call. They can be one landing page or one page with a strong overview section and a site list section. See [`app/dashboard/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/page.tsx#L16) and [`app/dashboard/sites/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/page.tsx#L1).
- Site status control is duplicated. The same pause/reactivate control appears in the site header and again in the site admin context. One canonical control in the site header, with admin linking into it, is enough if the backend action stays the same. See [`app/dashboard/sites/[id]/site-header.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/site-header.tsx#L12).
- Customer site operations can be grouped into one hub. Configuration, domains, crawl/serve state, pages, and automation are currently split across separate routes and repeated summaries. They can be sections in one canonical site hub, with deep links or anchors for detail. See [`app/dashboard/sites/[id]/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/page.tsx#L148) and [`app/dashboard/sites/[id]/pages/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/pages/page.tsx#L210).
- Translation governance can be one UI surface. Glossary, manual overrides, localized slugs, and consistency governance are currently separate routes but they all live under the same `edit`-based translation-authoring contract. A single “Translation rules” area with tabs is feasible. See [`app/dashboard/sites/[id]/overrides/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx#L136) and [`app/dashboard/sites/[id]/consistency/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/consistency/page.tsx#L179).
- Agency overview and customer directory can be collapsed into one agency hub. Both are agency-only and both are primarily workspace-switching plus plan/status inventory. The current split is useful for navigation but not required by permission. See [`app/dashboard/agency/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/page.tsx#L9) and [`app/dashboard/agency/customers/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/customers/page.tsx#L20).
- Internal ops accounts, showcases, and previews can be one ops hub with tabs or segmented navigation. They share the same internal-ops gate and the same actor-auth contract. Keep detail pages, but stop making the landing surfaces feel like three unrelated products. See [`app/dashboard/ops/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/page.tsx#L15), [`app/dashboard/ops/accounts/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/page.tsx#L78), and [`app/dashboard/ops/showcases/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/showcases/page.tsx#L22).
- The no-account claim screen and the new-site wizard are sequential steps in one acquisition funnel. They should feel like phases of the same flow, not two separate mental models. See [`app/dashboard/no-account/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/page.tsx#L27) and [`app/dashboard/sites/new/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/new/page.tsx#L66).

## 3. Where Duplication Is Actually Necessary

- Actor and subject workspace labels are necessary. The dashboard must show whether the current view is acting as the agency or the customer because `setWorkspaceAction()` only permits the actor account or active agency-managed customers. See [`app/dashboard/_lib/workspace-actions.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/_lib/workspace-actions.ts#L18) and [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L468).
- Status labels are semantically distinct and should stay separate. `site.status`, `domain.status`, `deployment.servingStatus`, `translationRun.status`, `showcase.status`, and `planStatus` are not interchangeable. Collapsing them into a single generic badge would erase real contract differences. See [`internal/dashboard/webhooks.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/webhooks.ts#L122) and [`internal/dashboard/webhooks.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/webhooks.ts#L887).
- Billing lock and feature lock are different failures. `mutationsAllowed` depends on both actor and subject plan status, while feature flags gate specific capabilities. A single “locked” state can be shared visually, but the reason text and remediation path should stay distinct. See [`internal/dashboard/auth.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/auth.ts#L500) and [`internal/dashboard/site-settings.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/internal/dashboard/site-settings.ts#L116).
- Customer settings and internal policy must remain separate. The site admin page limits itself to site-level routing and runtime settings, while the internal-ops account policy page controls plan assignment, managed-demo state, and flag overrides. See [`app/dashboard/sites/[id]/admin/internal-admin-policy-card.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/internal-admin-policy-card.tsx#L12) and [`app/dashboard/ops/accounts/[accountId]/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/[accountId]/page.tsx#L1).
- Agency customer plan assignment is intentionally narrower than internal ops. Agency users can move managed customers between Starter and Pro, but not assign Free or Agency; internal ops can edit the full managed-account policy. See [`app/dashboard/agency/actions.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/agency/actions.ts#L51) and [`app/dashboard/ops/accounts/actions.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/accounts/actions.ts#L78).
- Managed demo and showcase surfaces must stay separate from customer site surfaces. The showcase contract uses public `t2.weblingo.app` URLs and a different status model, even though it references the same site. See [`app/dashboard/ops/showcases/page.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/ops/showcases/page.tsx#L22) and [`app/dashboard/sites/[id]/admin/site-showcase-card.tsx`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/sites/[id]/admin/site-showcase-card.tsx#L1).
- The no-account claim flow must stay distinct from the normal dashboard. It is not just another onboarding step; it is a separate portal state. See [`app/dashboard/no-account/actions.ts`](file:///Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website/app/dashboard/no-account/actions.ts#L13).

## 4. Simplifications That Are Safe Versus Unsafe

### Safe

- Collapse `Overview` + `Sites` into one landing experience.
- Make `Site` the canonical customer hub, with sections for configuration, domains, crawl/serve, pages, and rules.
- Keep one visible status toggle per site, ideally in the site header.
- Merge glossary, overrides, slugs, and consistency into one translation-governance area with tabs.
- Merge agency overview and customer directory into one agency hub.
- Merge ops accounts, showcases, and previews into one internal-ops hub.
- Treat no-account and new-site as one onboarding funnel.

### Unsafe

- Hide actor vs subject context. The user must know when they are acting as the agency and when they are inside a customer workspace.
- Merge internal ops into customer settings. That would blur a real auth boundary and make the product harder to reason about.
- Flatten all site settings into one form. The backend explicitly separates capability buckets, and the UI should preserve that structure even if it is visually grouped.
- Remove distinct status types. Reusing one generic “active” / “paused” vocabulary would misrepresent different backend contracts.
- Collapse billing, feature, and workspace gating into one lock state without explanation.

## Ranked Simplification Backlog

1. Make the customer site hub canonical. Keep the current detail route as the main working surface and demote the other customer subroutes into anchors or secondary drill-ins.
2. Remove repeated site status controls from page header and admin. Keep one canonical control.
3. Merge translation governance pages into one route or one tabbed surface.
4. Collapse `Overview` and `Sites` into one landing page.
5. Collapse agency overview and customers into one agency hub.
6. Collapse internal ops accounts, showcases, and previews into one ops hub.
7. Rework no-account and new-site into one explicit onboarding funnel.
8. Keep developer tools as a support/debug surface only, not as a first-class dashboard destination.

## Proposed New IA

- Customer
  - Dashboard home
  - Site hub
  - Translation governance
  - New site
  - Billing and access
- Agency
  - Agency hub
  - Customer directory
  - Customer workspace
- Internal ops
  - Ops hub
  - Managed account policy
  - Preview review detail
  - Showcase detail

## Final Read

The dashboard’s biggest simplification opportunity is not permission flattening. It is reducing the number of places where the same customer work can be started, summarized, or edited. The role boundaries are real, and the UI should make those boundaries obvious instead of pretending they are one generic dashboard.
