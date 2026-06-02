# API Playbooks

Human workflow playbooks built on top of generated operation contracts. Payload schemas/examples live in `API_REFERENCE.md`.

## Conventions

- Base path: `/api`
- Use dashboard JWTs in `Authorization: Bearer <token>` unless noted.
- Refer to operations by OpenAPI `operationId`.

## Playbook: Account & Language Setup

1. Ensure account exists for current authenticated user:
   - `operationId`: `accounts.claim`
2. Fetch account context, entitlements, and quotas:
   - `operationId`: `accounts.me`
3. Load supported locale options for onboarding forms:
   - `operationId`: `meta.languages.list`
   - Use these exact tags for language-bearing create/update/preview requests; supported casing aliases canonicalize, unsupported tags fail fast.

## Playbook: Site Portfolio Management

This legacy-named playbook covers normal customer current-website management plus agency-owned
portfolio contexts. Normal customer subjects resolve zero or one current website; agency-owned
contexts can still use portfolio-style site lists.

1. List agency customer accounts (agency plans):
   - `operationId`: `agency.customers.list`
2. Create/invite agency customer account (agency plans):
   - `operationId`: `agency.customers.create`
3. Update an existing managed customer between Starter and Pro:
   - `operationId`: `agency.customers.update`
4. List sites for the current subject. Normal customer subjects resolve zero or one current website;
   agency-owned contexts can still list portfolio sites:
   - `operationId`: `sites.list`
5. Load consolidated site dashboard payload (detail + deployments, optional pages):
   - `operationId`: `sites.dashboard.get`
6. Poll compact customer-safe site status while crawl or translation work is active:
   - `operationId`: `sites.status.get`
7. Review customer-safe site errors with required offset pagination:
   - `operationId`: `sites.errors.summary.get`
8. Preview source-selection rule changes before saving:
   - `operationId`: `sites.sourceSelection.preview`
9. Preview source-selection tree projections for dashboard editing:
   - `operationId`: `sites.sourceSelection.treePreview`
10. Review observed runtime requests before adding interactive-feature rules:

- `operationId`: `sites.runtimeRequests.observations.list`

11. Update observation lifecycle after triage:

- `operationId`: `sites.runtimeRequests.observations.lifecycle`

12. Preview runtime request policy drafts before saving:

- `operationId`: `sites.runtimeRequestPolicy.preview`

13. Update site configuration:

- `operationId`: `sites.update`

14. Update indexing policy after readiness checks pass:

- `operationId`: `sites.indexingPolicy.update`

15. List discovered pages for a site:

- `operationId`: `sites.pages.list`

16. Generate language switcher snippets for custom frontend integration:
    - `operationId`: `sites.switcherSnippets.get`

## Playbook: Admin Managed Demos

1. List managed demo sites across the current internal admin account:
   - `operationId`: `admin.managedDemos.list`
2. Search managed customer accounts across the current internal admin account:
   - `operationId`: `admin.accounts.list`
3. Load a single managed account policy surface:
   - `operationId`: `admin.accounts.get`
4. Update managed account plan, quotas, or flags:
   - `operationId`: `admin.accounts.update`
5. Create a managed demo account, first site, and showcase namespace:
   - `operationId`: `admin.managedDemos.create`
6. Inspect and manage the showcase namespace for a managed demo site:
   - `operationId`: `sites.showcase.get`
   - `operationId`: `sites.showcase.create`
   - `operationId`: `sites.showcase.update`

## Playbook: Serving Access and Previews

1. Ensure locale serving is enabled:
   - `operationId`: `sites.locales.serve`
2. Serve localized pages from deployment routes:
   - `GET /{path}`
3. Serve preview artifacts:
   - `GET /_preview/{previewId}`

## Playbook 1: Dashboard Bootstrap and Site Setup

1. Mint dashboard token for API calls:
   - `operationId`: `auth.token.mint`
2. Optional bootstrap for actor/subject account context:
   - `operationId`: `dashboard.bootstrap`
3. Create site and locale/domain onboarding records:
   - `operationId`: `sites.create`
   - Customer `free`, `starter`, and `pro` accounts support one active/current website. A second
     create or reactivation returns `single_site_account_limit`; update the existing site for
     source URL changes or rebrands. Agency portfolio semantics are unchanged.
4. Inspect site and deployments:
   - Recommendation: use `sites.dashboard.get` for dashboard/detail screens to minimize round trips; use `sites.get` + deployments endpoints when you need separate caching or independent refresh cadence.
   - Deployment endpoint choice: use `sites.deployments.list` when you need the current active deployments for a site. Use `sites.deployments.history.list` when you need past deployment attempts and historical records.
   - `operationId`: `sites.dashboard.get`
   - `operationId`: `sites.status.get`
   - `operationId`: `sites.errors.summary.get`
   - `operationId`: `sites.get`
   - `operationId`: `sites.deployments.list`
   - `operationId`: `sites.deployments.history.list`

## Playbook 2: Domain Verification and Serving Activation

Cloudflare for SaaS flow:

1. Create site (if not already done):
   - `operationId`: `sites.create`
2. Provision custom hostname after customer CNAME is live:
   - `operationId`: `sites.domains.provision`
3. Refresh validation status if certificate/hostname lags:
   - `operationId`: `sites.domains.refresh`
4. Enable locale serving:
   - `operationId`: `sites.locales.serve`
5. After verified domains, active deployments, and language readiness checks pass, opt the site into
   customer-domain indexing:
   - `operationId`: `sites.indexingPolicy.update`

Local/dev TXT verification flow:

1. Verify domain token (`_weblingo.<domain>` TXT or test token):
   - `operationId`: `sites.domains.verify`
2. Enable locale serving:
   - `operationId`: `sites.locales.serve`
3. Keep indexing disabled for local/dev sites; only production customer domains should be opted in:
   - `operationId`: `sites.indexingPolicy.update`

## Playbook 3: Crawl and Translate Lifecycle

1. Trigger crawl run:
   - `operationId`: `sites.crawl.trigger`
2. Optional page-only crawl:
   - `operationId`: `sites.pages.crawl`
3. Optional crawl+translate for targeted pages:
   - `operationId`: `sites.crawl_translate.trigger`
4. Translate without recrawl (translation run):
   - `operationId`: `sites.translate`
5. List run history for dashboard/customer history:
   - `operationId`: `sites.translationRuns.list`
6. Observe run status:
   - `operationId`: `sites.translationRuns.get`
7. Operational controls:
   - `operationId`: `sites.translationRuns.cancel`
   - `operationId`: `sites.translationRuns.resume`

## Playbook 4: Translation Quality and Content Controls

1. Read/update glossary terms:
   - `operationId`: `sites.glossary.get`
   - `operationId`: `sites.glossary.put`
2. List and manage canonical phrase memory entries:
   - `operationId`: `sites.consistency.cpm.list`
   - `operationId`: `sites.consistency.cpm.upsert`
3. List and manage consistency blocks:
   - `operationId`: `sites.consistency.blocks.list`
   - `operationId`: `sites.consistency.blocks.update`
4. Surface override hygiene warnings for context-scoped conflicts:
   - `operationId`: `sites.consistency.overrideHygiene.list`
5. Apply manual override:
   - `operationId`: `sites.overrides.create`
6. Set translated slug path:
   - `operationId`: `sites.slugs.set`
7. Run consistency lint/fix for a locale (dry-run first, then apply if safe):
   - `operationId`: `sites.consistency.fix.run`
   - Request: `POST /api/sites/:siteId/consistency/fix` with boolean `dryRun` (`true` = preview/no writes, `false` = apply rewrites + enqueue render).
   - Default: `dryRun=true` when omitted.
   - Expected response signals: dry-run returns `rewritesPlanned`/samples without mutations; live apply returns `rewritesApplied` and `renderEnqueued`.
8. Toggle locale serve state if needed:
   - `operationId`: `sites.locales.serve`

## Playbook 5: Previews and Notifications

1. Create try-now preview:
   - `operationId`: `previews.create`
2. Poll preview status:
   - `operationId`: `previews.status`
3. Collect structured overlay feedback after the preview reaches a terminal outcome (`ready` or `failed`):
   - `operationId`: `previews.feedback`
4. Attach email while the preview is still in flight (`pending` or `processing`):
   - `operationId`: `previews.updateEmail`
5. Configure digest email subscription:
   - `operationId`: `digests.subscription.upsert`
6. Configure per-locale translation summary frequency:
   - `operationId`: `sites.locales.translationSummary.put`
7. Read translation summary rollups:
   - `operationId`: `sites.translationSummaries.list`

## Playbook: Prospect Showcase Conversion

1. Create a public prospect showcase request from the try form:
   - `operationId`: `prospectShowcases.create`
2. Poll the prospect showcase status until the demo is ready or failed:
   - `operationId`: `prospectShowcases.status`
3. Request a fresh access link from the expired-link recovery screen:
   - `operationId`: `prospectShowcases.accessLinkResend`
4. Open the demo workspace with the emailed or in-flow claim token:
   - `operationId`: `prospectShowcases.claim`
5. Convert the demo into a customer-owned starter site after the user confirms ownership:
   - `operationId`: `prospectShowcases.convert`

## Playbook 6: Operations and Incident Response

1. Inspect pipeline status for a page version:
   - `operationId`: `sites.pipeline.status.get`
2. Inspect DLQ backlog for a site:
   - `operationId`: `sites.dlq.list`
3. Replay DLQ messages after root-cause fix:
   - `operationId`: `sites.dlq.replay`

## Deprecated Manual Endpoint Doc

`API_ENDPOINTS.md` is retained only as a deprecation pointer. Use generated `API_REFERENCE.md` + this playbook document for all current workflows.
