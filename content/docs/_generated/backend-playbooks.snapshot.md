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

## Playbook: Site Portfolio Management

1. List agency customer accounts (agency plans):
   - `operationId`: `agency.customers.list`
2. Create/invite agency customer account (agency plans):
   - `operationId`: `agency.customers.create`
3. List portfolio sites:
   - `operationId`: `sites.list`
4. Load consolidated site dashboard payload (detail + deployments, optional pages):
   - `operationId`: `sites.dashboard.get`
5. Update site configuration:
   - `operationId`: `sites.update`
6. List discovered pages for a site:
   - `operationId`: `sites.pages.list`
7. Generate language switcher snippets for custom frontend integration:
   - `operationId`: `sites.switcherSnippets.get`

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
4. Inspect site and deployments:
   - Recommendation: use `sites.dashboard.get` for dashboard/detail screens to minimize round trips; use `sites.get` + deployments endpoints when you need separate caching or independent refresh cadence.
   - Deployment endpoint choice: use `sites.deployments.list` when you need the current active deployments for a site. Use `sites.deployments.history.list` when you need past deployment attempts and historical records.
   - `operationId`: `sites.dashboard.get`
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

Local/dev TXT verification flow:

1. Verify domain token (`_weblingo.<domain>` TXT or test token):
   - `operationId`: `sites.domains.verify`
2. Enable locale serving:
   - `operationId`: `sites.locales.serve`

## Playbook 3: Crawl and Translate Lifecycle

1. Trigger crawl run:
   - `operationId`: `sites.crawl.trigger`
2. Optional page-only crawl:
   - `operationId`: `sites.pages.crawl`
3. Optional crawl+translate for targeted pages:
   - `operationId`: `sites.crawl_translate.trigger`
4. Translate without recrawl (translation run):
   - `operationId`: `sites.translate`
5. Observe run status:
   - `operationId`: `sites.translationRuns.get`
6. Operational controls:
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
3. Configure digest email subscription:
   - `operationId`: `digests.subscription.upsert`
4. Configure per-locale translation summary frequency:
   - `operationId`: `sites.locales.translationSummary.put`
5. Read translation summary rollups:
   - `operationId`: `sites.translationSummaries.list`

## Playbook 6: Operations and Incident Response

1. Inspect pipeline status for a page version:
   - `operationId`: `sites.pipeline.status.get`
2. Inspect DLQ backlog for a site:
   - `operationId`: `sites.dlq.list`
3. Replay DLQ messages after root-cause fix:
   - `operationId`: `sites.dlq.replay`

## Deprecated Manual Endpoint Doc

`API_ENDPOINTS.md` is retained only as a deprecation pointer. Use generated `API_REFERENCE.md` + this playbook document for all current workflows.
