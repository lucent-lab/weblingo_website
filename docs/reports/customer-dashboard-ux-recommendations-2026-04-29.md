# WebLingo Customer Dashboard UX Recommendations

Date: 2026-04-29  
Scope: WebLingo customer-facing dashboard for managing translated websites  
Status: Product/UX analysis only; no implementation plan or code changes

## Executive Summary

WebLingo should not become an operations console by default. The customer dashboard should answer four daily questions quickly:

1. Is my translated website live?
2. Which languages or domains need attention?
3. Did the latest crawl/translation/deploy finish?
4. What is the next safe action?

The current dashboard exposes many important backend capabilities, but it reflects implementation domains more than customer jobs. Site state, domains, deployments, pages, crawl controls, translation runs, glossary, overrides, slugs, consistency, serving toggles, automation, notification controls, and settings are spread across several surfaces. This makes the product feel powerful but hard to operate.

The recommended direction is an action-oriented site workspace with progressive disclosure:

- Primary daily surface: site health, language/domain live status, active work, failures, and clear next actions.
- Secondary operational surface: pages and crawl details, including searchable/filterable page records once the backend supports server-side filters.
- Occasional configuration surfaces: settings, translation rules, automation, notifications, developer tools.
- Support/internal-only surfaces: raw recordings, manifests, low-level deployment artifacts, DLQ/replay, and rollback until customer-safe product semantics exist.

The user's idea of a paginated pages table is directionally useful, but the proposed page-by-language live matrix should not be the main dashboard unless the backend exposes reliable per-page/per-language coverage and customers prove they need that density. Today the backend's `PageSummary` contract exposes page timestamps, not per-language deployment state.

## Context for Analysts

WebLingo translates static websites through a deterministic pipeline:

1. Crawl and capture source page snapshots.
2. Segment/extract translatable content.
3. Translate through precedence rules.
4. Render deterministic manifests.
5. Publish deployments.
6. Serve translated pages through Cloudflare Workers using KV/R2 without database reads on the hot path.

The backend source of truth is Supabase/Postgres. R2 stores snapshots, manifests, and rendered HTML. KV stores deployment pointers and idempotency state. The serve path must remain DB-free.

The current website dashboard lives in the separate `weblingo_website` repository. Its canonical backend/dashboard integration document is `docs/backend/DASHBOARD_SPECS.md`.

## Evidence Reviewed

Backend and contract sources:

- `weblingo/docs/MVP_TDD_Implementation_Guide.md`
- `weblingo/docs/tasks/M14.8.md`
- `weblingo/docs/tasks/M18.md`
- `weblingo/docs/backend/DASHBOARD_SPECS.md`
- `weblingo/docs/reports/backend-dashboard-doc-sync-plan-2026-02-16.md`
- `weblingo/docs/reference/feature-catalog.generated.json`

Website/dashboard sources:

- `weblingo_website/docs/backend/DASHBOARD_SPECS.md`
- `weblingo_website/docs/dashboard-flow-and-use-cases.md`
- `weblingo_website/docs/reports/customer-dashboard-ia-proposal-2026-04-10.md`
- `weblingo_website/app/dashboard/sites/[id]/page.tsx`
- `weblingo_website/app/dashboard/sites/[id]/pages/page.tsx`
- `weblingo_website/app/dashboard/sites/[id]/admin/page.tsx`
- `weblingo_website/app/dashboard/sites/[id]/overrides/page.tsx`
- `weblingo_website/app/dashboard/_components/sites-nav.tsx`
- `weblingo_website/internal/dashboard/webhooks.ts`
- `weblingo_website/internal/dashboard/data.ts`

External UX guidance:

- Nielsen Norman Group, [Data Tables: Four Major User Tasks](https://www.nngroup.com/articles/data-tables/): tables should support finding records, comparing data, viewing/editing a single row, and acting on records.
- Office for National Statistics service manual, [Advanced formats: Dashboards](https://service-manual.ons.gov.uk/data-visualisation/guidance/dashboards): dashboards are justified when users revisit frequently updated high-level indicators; put important insights prominently and validate against user needs.
- Government Analysis Function, [Testing dashboards for design and accessibility](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-testing-dashboards-for-design-and-accessibility/): use inverted-pyramid structure, minimize clicks, avoid horizontal scrolling, paginate large tables, use filters, reduce visual clutter, and design for accessibility.

Independent challenge review:

- A GPT-5.5 read-only reviewer was asked to challenge the proposed direction using the `challenging-reviewer` stance. The strongest objections are incorporated throughout this report.

## Product Principle

The dashboard should be organized around customer jobs, not backend nouns.

Backend nouns:

- site
- page
- page version
- deployment
- manifest
- crawl run
- translation run
- KV pointer
- R2 artifact
- glossary
- override
- slug
- consistency block

Customer jobs:

- get translated pages live
- know what is live now
- fix broken setup
- refresh translations after source-site changes
- improve translation quality
- pause unsafe output
- add a language
- verify SEO/routing basics
- understand usage and plan limits

The dashboard can expose backend reality, but only after translating it into customer decisions.

## Customer Personas and Jobs

### Small Business Owner

Likely needs:

- Know whether translated languages are live.
- Follow clear DNS/domain setup steps.
- Add a language without understanding pipeline details.
- Refresh translations after editing the source site.
- See billing/plan limits without hunting.

Risk:

- Overwhelmed by artifacts, manifests, deployment IDs, histories, and run controls.

### Marketing or Content Manager

Likely needs:

- Check which pages were updated.
- Know whether translations are complete by language.
- Fix terminology through glossary.
- Override high-value translations.
- Update localized slugs or SEO-facing strings.

Risk:

- Needs page-level visibility, but not raw recording/manifests.

### Agency Operator

Likely needs:

- Switch between customer workspaces.
- See customer/site health across a portfolio.
- Identify blocked customer sites.
- Standardize language/domain setup.
- Use more advanced troubleshooting than normal customers.

Risk:

- May justify denser tables than direct customers, but this should be role-specific.

### Internal Support/Ops

Likely needs:

- Inspect raw snapshots, manifests, R2/KV state, DLQ messages, and rollback/pointer recovery.
- Diagnose pipeline failures.
- Help customers recover from bad deployments.

Risk:

- These tools should not leak into the normal customer IA.

## Daily, Occasional, and Rare Features

### Daily or Often

These belong in the primary site workspace or global dashboard overview.

| Customer question | Recommended feature | Primary UI treatment |
|---|---|---|
| Is my site live? | Overall site status, verified domain count, serving languages count | Top health strip |
| Which languages are live? | Per-language serving/deployment summary | Compact table or status list |
| What needs action? | Action queue: verify DNS, retry failed run, enable serving, update billing | Prominent task list |
| Is translation running? | Active translation/crawl run progress | Inline progress card |
| Did anything fail? | Failed pages/runs summary with retry/resume action | Alert with drill-down |
| Did my latest source change get processed? | Last crawl, pages changed, pages pending | Summary metric with link to pages |
| Can I refresh now? | Site/page crawl eligibility and quota remaining | Action button with quota context |

### Occasional

These should be available but should not dominate the default dashboard.

| Customer job | Recommended feature | Primary location |
|---|---|---|
| Add/remove languages | Locale editor, plan cap messaging, auto-translation confirmation | Settings |
| Change domains/routing | Domain pattern, route prefixes, verification/provisioning | Settings or Setup section |
| Improve terminology | Glossary | Translation Rules |
| Fix a specific translation | Manual override | Translation Rules |
| Fix localized URL | Slug editor | Translation Rules |
| Review recent deployments | Deployment history | Collapsed section under Activity/History |
| Configure summaries | Digest and locale translation summary preferences | Notifications/Automation |
| Add switcher snippet | Language switcher snippet generator | Developer Tools or Integration |
| Configure webhooks | Webhook URL/secret/events | Developer Tools or Automation |

### Rare, Support-Only, or Internal-Ops First

These should not be normal customer features until product semantics and safety are designed.

| Feature | Why not primary customer UX | Safer near-term alternative |
|---|---|---|
| Raw page recording inspection | Exposes implementation details and can create privacy/security review needs | Show last captured time, source hash/change status, crawl error |
| Manifest inspection | Deterministic manifest details are too technical and easy to misinterpret | Show page render status and whether output is current |
| Artifact manifest browser | Useful for support, not daily management | Keep behind internal ops |
| Customer-facing snapshot restore | Current rollback semantics are low-level pointer/artifact recovery, not a customer-safe audited workflow | Pause serving, retry failed pages, re-run translation, support-assisted recovery |
| DLQ/replay controls | Operational recovery can duplicate work or confuse customers | Show "support required" incident state |
| Per-page/per-language matrix with live cells | Backend does not currently expose reliable cell-level contract | Start with language deployment summary and page table drill-down |

## Recommended Information Architecture

### Global Dashboard

Purpose: account-level orientation and "what needs attention".

Recommended content:

- Account/plan state and usage.
- Sites list with health summary.
- Action queue across sites.
- Recent incidents or blocked setup.
- Add-site CTA if allowed.

Do not include:

- Full deployment history.
- Full page tables.
- Glossary/override forms.
- Developer snippets.

### Site Workspace

Purpose: daily operational command center for one website.

Recommended top-level layout:

1. Site identity and health.
2. Action queue.
3. Languages and live status.
4. Active work.
5. Pages and crawl summary.
6. Recent activity.
7. Secondary links to settings, rules, automation, developer tools.

The current `app/dashboard/sites/[id]/page.tsx` is the right base, but it should stop mixing advanced automation and notification tools into the daily surface. "Automation and notifications" should move to a secondary page or collapsed advanced section.

### Pages and Crawl

Purpose: operational drill-down for source pages.

Recommended content:

- Search by source path.
- Filter by crawl state: never crawled, stale, changed, failed, eligible now.
- Filter by lifecycle state if backend exposes it: untranslated, partial, complete.
- Sort by last crawled, last changed, next crawl, source path.
- Paginated table with stable URLs for filters.
- Row detail drawer/page for one source page.

Initial table columns:

- Source path.
- Current source state: never seen, unchanged, changed, failed.
- Last crawl.
- Last source change/snapshot.
- Next eligible crawl.
- Translation coverage summary, only if backend exposes it accurately.
- Primary action: recrawl page.

Avoid:

- A wide page × language matrix as the default.
- Horizontal scrolling as the main interaction.
- Client-side filtering over one loaded page of paginated results.

### Page Detail

Purpose: inspect one page without turning the table into a dense operations grid.

Recommended content:

- Source URL/path.
- Last capture summary.
- Latest source version timestamp.
- Translation status per language.
- Current deployment per language.
- Customer-safe actions: recrawl page, retranslate page, pause language serving if relevant.
- Links to translation rules affecting this page.
- Recent page-level events if backend supports them.

Do not expose by default:

- Raw HTML recordings.
- Full manifest JSON.
- R2 key names.
- KV pointer details.

### Translation Rules

Purpose: quality governance.

Keep this separate from day-to-day status because users visit it when improving quality, not every time they check live state.

Recommended sections:

- Locale scope selector.
- Glossary.
- Manual overrides.
- Localized slugs.
- Consistency governance.
- Conflict/hygiene warnings.

The current website already redirects the old consistency route into translation rules, which is directionally good. The remaining improvement is making the locale scope and quality impact clearer.

### Settings

Purpose: durable site configuration.

Recommended sections:

- Basics: source URL, source language, status.
- Languages: target languages, aliases, plan cap.
- Routing/domains: route pattern, domains, DNS status.
- Serving mode: strict/tolerant, serving toggles.
- Runtime: client runtime, SPA refresh, translatable attributes.
- Profile: brand voice and site context.
- Integrations: webhooks, switcher snippets if not separated into Developer Tools.

Destructive source URL changes should require explicit confirmation because backend docs state they wipe pages/translations/deployments and reset status.

### Activity and History

Purpose: answer "what changed recently?" without overwhelming the main workspace.

Recommended content:

- Recent crawl runs.
- Recent translation runs.
- Recent deployment attempts grouped by locale.
- Recent glossary/override/slug changes if audit data exists.
- Filter by event type and language.

Deployment history should remain collapsed or secondary. Deployment IDs and artifact details are useful for support but not a default customer decision.

### Developer Tools

Purpose: implementation/integration surfaces.

Recommended content:

- API base and docs link.
- Webhook configuration.
- Language switcher snippets.
- Runtime install/verification instructions.
- Tokens/config diagnostics if safe.

Do not make developer tools part of the daily site workspace.

## The Page Table Question

The proposed paginated/filtered table of website pages is useful, but it should be designed around table jobs:

- Find pages matching criteria.
- Compare page states.
- Open one page detail.
- Take action on selected records.

This aligns with NN/G's table guidance. But a table becomes harmful when it tries to show every operational dimension at once.

### Recommended V1 Page Table

Use this once backend-supported filtering exists:

| Column | Purpose |
|---|---|
| Source path | Identify the page |
| Source state | Understand whether the source changed, failed, or is stale |
| Last crawled | Recency |
| Last changed | Whether translation should be refreshed |
| Next crawl | Eligibility/quota context |
| Coverage | Compact summary such as `3/4 languages current`, not separate cells |
| Issues | Failed/blocked count |
| Action | Recrawl, open detail |

Recommended filters:

- Path search.
- Language.
- Live status: live, not live, blocked, disabled.
- Translation coverage: complete, partial, missing.
- Crawl state: eligible, stale, failed, never crawled.
- Last changed range.
- Domain/route prefix if multi-domain sites become common.

Recommended table behavior:

- Server-side pagination.
- Server-side filtering and sorting.
- Filter state in the URL.
- No hidden hover-only row actions.
- One primary inline row action; overflow menu only for secondary actions.
- Bulk actions only when the semantics are unambiguous across pages.

### Why Not Page × Language Cells by Default

A cell matrix looks attractive because WebLingo has pages and languages. But it creates several problems:

- It implies backend support for per-page/per-language live state that is not currently in the public dashboard contract.
- It becomes horizontally wide as languages grow.
- It makes customers inspect many cells instead of telling them what needs action.
- It mixes page freshness, translation progress, serving state, domain verification, and deployment state into one visual model.
- It risks making partial/in-progress states ambiguous.

Recommended alternative:

- Show compact coverage in the table.
- Open a page detail drawer for per-language detail.
- Keep per-language live state primarily in the language/deployment summary.

## Language and Deployment Status Model

Customers should see status by language because languages are how they understand the translated site.

Recommended language status fields:

- Language.
- Domain/route.
- Serving status: serving, ready, needs domain, disabled, inactive, degraded.
- Current deployment timestamp.
- Coverage: pages current / total.
- Active run: queued/in progress/failed/completed.
- Primary action: verify domain, translate & serve, retry failed pages, enable/disable serving.

Do not show by default:

- Artifact manifest JSON.
- Raw deployment IDs except as expandable technical details.
- KV pointer keys.

## Translation History and Restore

### What Customers Actually Need

Customers usually need recovery from one of these failures:

- A source page changed and translation did not update.
- A language is not live.
- A translation is wrong.
- A deployment failed.
- A new language is incomplete.

The first-line recovery actions should be:

- Recrawl page/site.
- Retry failed pages.
- Resume stalled translation.
- Cancel active run.
- Pause serving for a language.
- Edit glossary/override/slug.
- Contact support for rollback.

### Why "Restore Previous Snapshot" Should Not Be Customer-Facing Yet

Current backend semantics include pointer restore and `prev.html`/deployment artifacts, but these are not the same as a product-safe restore workflow. A customer-facing restore feature needs:

- A clearly named restore target.
- Scope: page, language, whole site, or deployment.
- Preview before restore.
- Audit trail.
- Confirmation of what will change.
- Roll-forward path.
- Pointer stale-write safety.
- Clear interaction with ongoing translation runs.
- Clear behavior for assets and deployment-scoped immutable snapshots.

Until that exists, "restore previous snapshot" should be support/internal only.

### Future Customer-Safe Rollback Design

If rollback becomes a priority, design it as "Restore deployment" rather than "restore snapshot".

Recommended future flow:

1. User opens Activity/History.
2. User selects a completed deployment for a language.
3. Dashboard shows what would change: language, deployment time, page count, affected routes.
4. User previews representative pages.
5. User confirms restore.
6. Backend performs audited, stale-write-safe pointer flip.
7. Dashboard shows restored deployment and creates an activity event.

This should not be built until backend contracts and tests are explicit.

## Page Recording Inspection

The user's instinct to inspect the page recording is valid for diagnosis, but normal customers should not need raw recordings.

Recommended customer-safe page capture summary:

- Last captured at.
- Capture mode: template, hydrated, or both.
- Snapshot changed: yes/no.
- Last source error if capture failed.
- Approximate page size if useful.
- Whether a new translation was triggered.

Recommended internal/support-only inspection:

- Raw server snapshot.
- Hydrated snapshot.
- Segment list.
- DOM locator/anchor details.
- Manifest ops.
- Rendered HTML.
- Placeholder validation details.

Reason:

The manifest contract depends on selectors, anchors, `expected_source`, checksums, and placeholder validation. Exposing these as normal UI creates noise and risk without helping most customer decisions.

## Current Dashboard Gaps

### Gap 1: No Clear Action Queue

The dashboard has many actions, but no single "what needs my attention" model.

Recommended feature:

- Site-level action queue:
  - Verify DNS for `fr.example.com`.
  - Translation run failed for German; retry failed pages.
  - Billing inactive; mutations disabled.
  - 12 pages eligible for recrawl.
  - French serving disabled.

This should be the first thing after the site header when issues exist.

### Gap 2: Status Domains Are Blended

Different statuses mean different things:

- `site.status`: active/inactive.
- Domain status: pending/verified/failed.
- Serving status: inactive/disabled/needs_domain/ready/serving/degraded.
- Crawl status: in progress/completed/failed.
- Translation run status: queued/in_progress/completed/failed/cancelled.
- Deployment status: backend-defined deployment attempt state.

Recommended feature:

- Use distinct status groups and labels.
- Never collapse these into one generic "live" badge.
- Provide a computed customer-facing headline while preserving drill-down detail.

### Gap 3: Pages View Is Too Thin for Search and Diagnosis

Current pages API/dashboard behavior supports pagination and per-page crawl action, but not meaningful server-side filters.

Recommended backend contract before UX expansion:

- `GET /sites/:siteId/pages?query=&status=&language=&coverage=&sort=&limit=&cursor=`
- Include stable aggregate fields for coverage and issue counts.
- Keep expensive per-page/per-language details out of default list payload.

### Gap 4: Advanced Controls Are Too Close to Daily Surface

The site workspace includes advanced controls such as crawl+translate selection, digest preferences, summary history fetch, and switcher snippets.

Recommended IA:

- Move automation and notification tools to secondary pages/sections.
- Keep only the most common action on the site workspace:
  - Translate & serve.
  - Retry/resume/cancel active run.
  - Verify/provision domain.
  - Recrawl site/page.

### Gap 5: Deployment History Exists but Is Not Productized

Deployment history currently shows recent attempts per locale. It is useful but support-flavored.

Recommended feature:

- Rename/reframe as "Recent activity" for customers.
- Show human-readable outcomes first.
- Keep deployment IDs and artifact details behind "technical details".

### Gap 6: No Page Detail Workflow

The current table links no full page detail workflow for translation coverage, page-specific runs, and rules affecting one page.

Recommended feature:

- Add a page detail drawer or route after backend coverage fields exist.
- Keep the table compact.

## Recommended Feature Set

### Must Have

1. Global account/site health overview.
2. Site workspace with action queue.
3. Language/domain serving summary.
4. Active crawl/translation run status.
5. Retry/resume/cancel controls for failed or stalled runs.
6. Domain verification/provisioning workflow.
7. Translate & serve workflow.
8. Pages and crawl summary.
9. Paginated pages table.
10. Server-side path search and filters.
11. Page detail view with customer-safe capture/translation/deployment summary.
12. Translation Rules surface: glossary, overrides, slugs, consistency.
13. Site Settings surface: languages, routing, serving mode, runtime, profile.
14. Activity/History surface with recent run/deployment outcomes.
15. Plan/usage and billing-blocked states on every relevant mutation surface.
16. Accessible table and keyboard interactions.

### Should Have

1. Saved page filters for agencies or large sites.
2. Bulk page recrawl for selected pages.
3. Coverage summary by language and page group.
4. Notifications center for failed runs or completion summaries.
5. Webhook configuration flow with test delivery.
6. Language switcher snippet preview.
7. SEO readiness summary: canonical/hreflang/sitemap status.
8. Source-site change detection summary.
9. Customer-safe incident explanations.
10. Exportable activity history for agencies.

### Could Have

1. Visual page preview comparison.
2. Translation QA workflow with approve/reject.
3. Per-page translation diff.
4. Rule impact preview before saving glossary/override changes.
5. Scheduled recrawl policy controls.
6. Team roles and permissions.
7. Cross-site agency health dashboard.
8. Advanced analytics for translated traffic.

### Do Not Expose to Customers Yet

1. Raw R2 key browser.
2. KV pointer editor.
3. Full manifest JSON inspector.
4. DLQ replay.
5. Customer-facing snapshot restore.
6. Low-level page-version management.
7. Raw page recording by default.

## Suggested Navigation

For normal customers:

- Dashboard
- Sites
- Site
  - Overview
  - Pages
  - Rules
  - Settings
  - Activity
- Developer Tools

For agency users:

- Agency Overview
- Customers
- Sites
- Customer Workspace
- Developer Tools

For internal operators:

- Ops
- Accounts
- Showcases
- Previews
- Support diagnostics

The current customer site nav already approximates `Workspace`, `Pages & crawl`, `Translation rules`, and `Settings`. The main changes are:

- Add or strengthen `Activity`.
- Move advanced automation/developer controls away from the default workspace.
- Make the workspace more action-driven.
- Avoid making pages/crawl the top-level mental model for every customer.

## Recommended Site Workspace Layout

```text
Site: example.com
Status strip:
  Active | 3/4 languages serving | 4/4 domains verified | Last crawl 2h ago | No active incidents

Needs attention:
  - German translation failed on 3 pages. [Retry failed pages]
  - Spanish domain certificate pending. [Check DNS]

Languages:
  FR  serving      fr.example.com   42/42 pages current   Last deployed 10:42
  DE  degraded     de.example.com   39/42 pages current   Failed run
  ES  ready        es.example.com   42/42 pages current   Serving disabled

Active work:
  Translation run for DE: failed, 39/42 complete. [Retry] [Cancel]

Pages summary:
  42 discovered | 3 pending/failed | 12 eligible for recrawl | 1 changed recently
  [Open pages]

Recent activity:
  Latest crawl, latest deployment, latest rule changes
```

## Recommended Pages Table Layout

```text
Filters:
  Search path... | Language | Coverage | Crawl state | Changed since | Sort

Table:
  Source path     Source state    Last crawled    Last changed    Coverage       Issues       Action
  /pricing        changed         2h ago          2h ago          3/4 current    DE failed    Open
  /about          unchanged       1d ago          1d ago          4/4 current    None         Recrawl
  /blog/post      never crawled   -               -               0/4 current    Missing      Crawl
```

Page detail:

```text
/pricing
Source:
  Last captured 10:31, hydrated+template, changed from previous capture

Languages:
  FR current and serving
  DE failed after translation; retry available
  ES translated but serving disabled
  JA current and serving

Actions:
  Recrawl page | Retranslate selected languages | Open rules affecting this page
```

## Backend/API Implications

The UX recommendation requires backend support before full implementation.

### Needed for Page Filters

Current page list contract supports `limit` and `offset`. A useful filtered table needs:

- Path search.
- Sort.
- Crawl state filter.
- Freshness/staleness filter.
- Optional language filter.
- Optional coverage filter.
- Cursor or stable offset pagination with deterministic ordering.

### Needed for Page Coverage

Avoid deriving page/language state client-side from partial deployments. Add a backend-owned summary:

```ts
type PageCoverageSummary = {
  pageId: string;
  sourcePath: string;
  latestPageVersionId: string | null;
  sourceState: "never_crawled" | "unchanged" | "changed" | "failed" | "unknown";
  lastCrawledAt: string | null;
  lastSnapshotAt: string | null;
  nextCrawlAt: string | null;
  totalTargetLangs: number;
  currentLangs: number;
  failedLangs: number;
  blockedLangs: number;
  servingLangs: number;
};
```

For page detail, add per-language detail:

```ts
type PageLanguageStatus = {
  targetLang: string;
  translationStatus: "not_started" | "queued" | "in_progress" | "current" | "stale" | "failed";
  servingStatus: "inactive" | "disabled" | "needs_domain" | "ready" | "serving" | "degraded";
  deploymentId: string | null;
  deployedAt: string | null;
  runId: string | null;
  issue: string | null;
};
```

### Needed for Activity

Provide a customer-facing activity stream, not just deployment history:

- Crawl started/completed/failed.
- Translation run started/completed/failed/cancelled/resumed.
- Deployment activated/failed.
- Domain verified/failed.
- Serving enabled/disabled.
- Glossary/override/slug changed.

### Needed for Rollback Later

Only if product validation proves rollback is needed:

- `GET /sites/:siteId/deployments/:deploymentId/restore-preview`
- `POST /sites/:siteId/deployments/:deploymentId/restore`
- Audit event.
- Idempotency key.
- Stale-write-safe pointer semantics.
- Tests for concurrent publish/restore.

## Accessibility and Responsive Requirements

The dashboard will be table-heavy, so accessibility must be designed upfront:

- Use semantic tables for tabular data.
- Keep table headers clear and persistent where possible.
- Avoid horizontal scrolling as the primary solution.
- Provide compact mobile alternatives: list rows or detail cards for page records.
- Make filters keyboard accessible.
- Keep filter state visible and removable.
- Ensure all action menus are discoverable without hover.
- Use text labels for ambiguous status icons.
- Do not rely on color alone for live/failed/blocked states.
- Use plain language and short status labels.
- Test at 200% zoom and common mobile/tablet widths.

## Risks and Tradeoffs

### Risk: Overbuilding an Operations Console

Dense tables, histories, and artifacts can make the product feel harder than the problem.

Mitigation:

- Use action queue and progressive disclosure.
- Keep support-only diagnostics separate.

### Risk: Hiding Needed Detail

Some customers, especially agencies, may need detailed page diagnostics.

Mitigation:

- Provide drill-downs and saved filters.
- Make role-specific density possible without forcing it on everyone.

### Risk: Inaccurate Status

If the dashboard derives status from incomplete frontend data, users will lose trust.

Mitigation:

- Backend owns aggregate status fields.
- Avoid page/language cells until the API supports them.

### Risk: Rollback Can Break Invariants

Customer-facing restore can conflict with publish, pointer safety, asset snapshots, and ongoing runs.

Mitigation:

- Do not expose until backend has explicit restore contracts and concurrency tests.

### Risk: More Filters Increase Complexity

Filters help large sites but can overwhelm small sites.

Mitigation:

- Start with search and status filters.
- Add advanced filters behind disclosure.
- Use empty/default states optimized for small sites.

## Research Questions Before Build

1. What is the median and 90th percentile page count per customer site?
2. How often do customers know the exact source URL they need to inspect?
3. Do customers think of problems by page, language, domain, or task?
4. Who performs translation QA?
5. What is the most common reason users return to the dashboard after setup?
6. What failure states generate support tickets today?
7. Do customers need audit/history, or only recent "what changed" summaries?
8. Would customers understand "deployment", "snapshot", and "manifest", or should these stay technical?
9. What recovery action do users expect after a bad translation?
10. How many customers need bulk page actions?

## Validation Plan

Recommended non-implementation validation:

1. Interview 5-8 likely customers or agency operators.
2. Ask them to rank dashboard jobs after setup.
3. Prototype only the site workspace and pages table in low fidelity.
4. Run task tests:
   - Find why German is not live.
   - Refresh `/pricing`.
   - Fix a bad translation.
   - Add Spanish.
   - Pause French serving.
   - Find what happened yesterday.
5. Measure time to first correct action.
6. Check whether users ask for raw recording/history/rollback unprompted.

## Recommended Delivery Order

This is not an implementation plan, but a sequencing recommendation for future planning.

1. Define customer-facing status taxonomy.
2. Design the site action queue.
3. Add backend aggregate fields needed by the action queue.
4. Redesign site workspace around health, language status, active work, and next actions.
5. Add server-side page search/filter contract.
6. Redesign pages table and add page detail.
7. Move advanced automation/developer controls out of daily workspace.
8. Reframe deployment history as recent activity.
9. Validate whether customer-safe rollback is needed.
10. If needed, design audited deployment restore as a separate backend capability.

## Final Recommendation

Build the dashboard around operational clarity, not maximum visibility.

The right main screen is not a giant page/language matrix. It is a site workspace that tells the customer what is live, what is blocked, what is running, and what action to take next.

The page table should exist, but as a drill-down with search, filters, pagination, and page detail. Per-language page detail belongs one level deeper unless customer research proves the matrix is the dominant workflow.

Raw recordings, manifests, deployment artifact internals, and restore controls should remain support/internal surfaces until WebLingo has explicit customer-safe contracts for them.

