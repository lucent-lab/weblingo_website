# WebLingo Customer Dashboard — Improvement Report & Codex Implementation Plan (Release 16.1.1)

Date: 2026-01-08  
Author: Senior Software Architect / Computer Scientist (consolidated spec for Codex execution)

## Inputs reviewed (non-authoritative)
This plan is a consolidation of three independent LLM code-review reports. They are **not** treated as ground truth; only items backed by concrete code artifacts in those reports are considered “verified”.

- `dashboard-review-2026-01-08-opus.md` (Claude Opus 4.5)
- `dashboard-review-2026-01-08-gpt.md` (GPT)
- `dashboard-review-2026-01-08-gemini.md` (Gemini)

---

## 1. Verified facts (use as source-of-truth for this plan)

### 1.1 Runtime / framework versions
- Next.js: **16.1.1** (from `package.json`, per reports)
- React: **19.2.3**
- Toasts: `sonner` is installed and already used in `useActionToast`
- Data fetching library: **No SWR and no React Query installed**

### 1.2 Confirmed code artifacts causing major UX/perf problems
#### A) `ActionForm` forces a full route refresh on every success
`components/dashboard/action-form.tsx` calls `router.refresh()` for any successful action without `meta.redirectTo`.

Impact: full RSC re-render, duplicated data fetching, scroll/focus reset, “page reload” feel after almost every action.

#### B) Per-row client ActionForms in big tables
Example: `app/dashboard/sites/[id]/pages/page.tsx` renders **one `<ActionForm>` per row** for “Force crawl”, multiplying hydration and hook instances.

#### C) URL-based toast/error banners exist on several pages
Pages parse `?toast=...` and `?error=...` and show dismiss links that trigger navigation, causing full re-renders.

#### D) Pages list endpoint has strict schema `{ pages: [...] }`
`listSitePagesResponseSchema` is `.strict()`. **You must not add response keys** (e.g., `total`, `nextCursor`) without updating the schema.

---

## 2. Cross-report coherence check

### 2.1 Items all reports agree on (high confidence)
- The single biggest UX/perf issue is the implicit `router.refresh()` in `ActionForm`.
- URL-query “toast/error” banners should be removed in favor of `sonner` toasts.
- Pages list needs pagination (or at least server-side limiting) to avoid huge payloads + hydration explosion.
- `actions.ts` is very large and should be split by domain (maintainability).
- `listSitesCached` is called redundantly in layout and pages.

### 2.2 Items that are inconsistent or uncertain (treat cautiously)
- Next.js version: one report mentions Next.js 15; others and the confirmed `package.json` say **16.1.1**.
- p95 scale estimates (pages/glossary size) differ. **Decision:** implement pagination + reduce refresh regardless of exact p95.

---

## 3. Release goals for 16.1.1 (what “done” means)

### 3.1 UX outcomes
1. **No full page refresh** after “row-level” actions like “Force crawl”.
2. **No URL-polluted banners** (`?toast=` / `?error=`) and no “Dismiss” links that navigate.
3. “Pages” view works efficiently for large sites via **pagination** (server-side limiting + UI pager).
4. Long-running operations (crawl/translate) have **live status updates** (polling) so users don’t need manual refresh.

### 3.2 Engineering outcomes
- Backward-compatible change to `ActionForm` so call sites opt out of refresh deliberately.
- No schema breaks: do not violate strict Zod response schemas.
- Minimal dependency changes (no SWR/React Query added for 16.1.1).

---

## 4. Implementation plan (milestones + atomic tasks)

> Conventions:
> - Each task is written so Codex can implement it **without interpretation**.
> - “Search” tasks include exact ripgrep patterns.
> - Every milestone includes explicit acceptance checks.

---

### Milestone M0 — Baseline, safety rails, and branch setup

- [ ] Create a new git branch: `dashboard/16.1.1-ux-perf`.
- [ ] Detect the package manager:
  - [ ] If `pnpm-lock.yaml` exists → use `pnpm`.
  - [ ] Else if `yarn.lock` exists → use `yarn`.
  - [ ] Else use `npm`.
- [ ] Install dependencies using the detected package manager.
- [ ] Run the full CI-equivalent locally:
  - [ ] `lint`
  - [ ] `typecheck`
  - [ ] `test` (if present)
  - [ ] `build`
- [ ] Record baseline metrics (manual note in PR description):
  - [ ] “Force crawl” triggers a full-page refresh (expected baseline).
  - [ ] Pages view renders all rows (expected baseline).

**Acceptance for M0:** Branch exists, repo builds cleanly before changes.

---

### Milestone M1 (P0) — Make refresh explicit + remove URL-based toasts/errors

#### M1.1 Refactor `ActionForm` to support opt-out refresh (backward compatible)

**File:** `components/dashboard/action-form.tsx`

- [ ] Add an optional prop to `ActionFormProps`:
  - [ ] `refreshOnSuccess?: boolean;`
- [ ] Replace the existing `useEffect` success handler with the exact logic below (copy/paste and adjust imports/types only if TypeScript requires it):

```tsx
useEffect(() => {
  if (wasPending.current && !pending && state.ok) {
    // Run callbacks first so they execute even if navigation happens.
    onSuccess?.(state);

    const redirectTo =
      typeof state.meta?.redirectTo === "string" ? (state.meta.redirectTo as string) : null;

    if (redirectTo) {
      router.push(redirectTo);
      wasPending.current = pending;
      return;
    }

    const metaRefresh =
      typeof state.meta?.refresh === "boolean" ? (state.meta.refresh as boolean) : undefined;

    // Backwards-compatible default: refresh unless explicitly disabled.
    const shouldRefresh = refreshOnSuccess ?? metaRefresh ?? true;

    if (shouldRefresh) {
      router.refresh();
    }
  }

  wasPending.current = pending;
}, [pending, state, router, onSuccess, refreshOnSuccess]);
```

- [ ] Ensure `refreshOnSuccess` is included in the effect dependency list.
- [ ] Do **not** change the initial state shape (`{ ok: false, message: "" }`).

**Acceptance for M1.1:**
- Existing call sites continue to refresh on success (no behavior regression).
- A call site that sets `refreshOnSuccess={false}` does **not** refresh.
- An action returning `{ meta: { refresh: false } }` does **not** refresh.

---

#### M1.2 Disable refresh for per-row “Force crawl” action in Pages table

**File:** `app/dashboard/sites/[id]/pages/page.tsx`

- [ ] Find the `<ActionForm ... action={triggerPageCrawlAction} ...>` used inside the table row loop.
- [ ] Add the prop `refreshOnSuccess={false}` to that `ActionForm`.

**Acceptance for M1.2:**
- Clicking “Force crawl” shows the toast but **does not** reset scroll position and does **not** trigger a full route refresh.

---

#### M1.3 Remove URL-based toast/error banners and “Dismiss” navigations

**Goal:** eliminate `?toast=` / `?error=` handling from dashboard pages and rely on `sonner` toasts only.

**Search (repo-wide):**
- [ ] Run `rg "searchParams\?: Promise<\{\s*toast\?:" app/dashboard -g'*.tsx'`
- [ ] Run `rg "decodeSearchParam\(" app/dashboard -g'*.tsx'`
- [ ] Run `rg "\?toast=|\?error=|&toast=|&error=" app/dashboard internal components -g'*.ts*'`

**For each page that implements URL banners (minimum list from reports):**
- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/admin/page.tsx`
- `app/dashboard/sites/[id]/pages/page.tsx`
- `app/dashboard/sites/[id]/overrides/page.tsx`

Perform the following edits **per file**:

- [ ] Delete the `searchParams` usage that parses `toast` / `error` / `details`.
- [ ] Delete the banner JSX block that conditionally renders based on `toastMessage` / `actionErrorMessage`.
- [ ] Delete the local helper `decodeSearchParam()` if it becomes unused after the removal.
- [ ] Update the page props type so it no longer expects `toast`/`error` search params.
- [ ] Ensure the page still renders and compiles with TypeScript.

**Acceptance for M1.3:**
- No dashboard page renders a “Dismiss” `<Link>` whose purpose is only to clear toast/error URL params.
- URLs no longer contain `toast`, `error`, or `details` from dashboard actions.

---

### Milestone M2 (P1) — Paginate “Pages” list end-to-end (backend + dashboard)

> Important constraint: `listSitePagesResponseSchema` is strict. The response must remain exactly:
>
> ```json
> { "pages": [ ... ] }
> ```

**Phase 1 note:** The backend pagination work (M2.1) lives in the webhooks worker repo. Until that ships, M2.3 UI pagination should remain deferred to avoid broken paging.

#### M2.1 Backend: support optional `limit` + `offset` on `GET /sites/:siteId/pages`

**Repo/file (per reports):** `workers/webhooks-worker/src/handlers/sites.ts` → handler `listPages` (or equivalent)

- [ ] Parse query params from the request URL:
  - [ ] `limit` (integer)
  - [ ] `offset` (integer)
- [ ] Apply validation:
  - [ ] If `limit` is missing → **do not** apply range/limit (preserve existing “return all pages” behavior).
  - [ ] If `limit` is present:
    - [ ] Default to 50 if parse fails
    - [ ] Clamp to `[1, 200]`
  - [ ] If `offset` is missing → default to 0
  - [ ] Clamp offset to `>= 0`
- [ ] If `limit` is present, apply `.range(offset, offset + limit - 1)` to the Supabase query.
- [ ] Keep existing ordering (e.g., by `last_seen_at DESC`). If supported, add a deterministic tie-breaker ordering by `id DESC` (only if it does not change semantics).
- [ ] Ensure the JSON response is still `{ pages: [...] }` with no extra keys.

**Acceptance for M2.1:**
- `GET /sites/:id/pages` without query params returns the same data as before.
- `GET /sites/:id/pages?limit=50&offset=0` returns at most 50 pages.
- `GET /sites/:id/pages?limit=50&offset=50` returns the next slice.

---

#### M2.2 Dashboard wrapper: add `limit` + `offset` support in `fetchSitePages`

**File:** `internal/dashboard/webhooks.ts`

- [ ] Update the function signature to:

```ts
export async function fetchSitePages(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SitePageSummary[]>
```

- [ ] Build query params using `URLSearchParams` and append them only if provided.
- [ ] Keep the strict schema decode unchanged.
- [ ] Return `data.pages` (do not change return type to the full object).

Reference implementation (copy/paste and adjust variable names to match existing code):

```ts
export async function fetchSitePages(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SitePageSummary[]> {
  const qs = new URLSearchParams();

  if (typeof options?.limit === "number") qs.set("limit", String(options.limit));
  if (typeof options?.offset === "number") qs.set("offset", String(options.offset));

  const path = qs.size ? `/sites/${siteId}/pages?${qs.toString()}` : `/sites/${siteId}/pages`;

  const data = await request({
    path,
    auth,
    schema: listSitePagesResponseSchema,
  });

  return data.pages;
}
```

**Acceptance for M2.2:**
- TypeScript compiles.
- Existing call sites still work (options is optional).
- Calling with options produces expected query string.

---

#### M2.3 Pages UI: implement server-side pagination in `Sites/[id]/pages`

**File:** `app/dashboard/sites/[id]/pages/page.tsx`

- [ ] Update `searchParams` typing to include `page?: string | string[]` (and **not** toast/error).
- [ ] Parse `page` as a 1-based integer:
  - [ ] If missing or invalid → set `pageNumber = 1`.
  - [ ] If `< 1` → set `pageNumber = 1`.
- [ ] Set constants:
  - [ ] `const pageSize = 50;`
  - [ ] `const offset = (pageNumber - 1) * pageSize;`
  - [ ] `const requestedLimit = pageSize + 1;` (fetch one extra row to detect `hasNextPage`)
- [ ] Fetch pages with options:
  - [ ] `const allPages = await fetchSitePages(authToken, id, { limit: requestedLimit, offset });`
- [ ] Derive:
  - [ ] `const hasNextPage = allPages.length > pageSize;`
  - [ ] `const visiblePages = hasNextPage ? allPages.slice(0, pageSize) : allPages;`
- [ ] Render table rows from `visiblePages` instead of `pages`.
- [ ] Add pager controls under the table:
  - [ ] Show “Previous” only when `pageNumber > 1` and link to `?page=${pageNumber - 1}`
  - [ ] Show “Next” only when `hasNextPage` and link to `?page=${pageNumber + 1}`
  - [ ] Keep the route stable (do not add additional query params).

**Acceptance for M2.3:**
- A site with > 50 pages shows exactly 50 rows and a “Next” link.
- Clicking “Next” shows the next page of rows and a “Previous” link.
- “Force crawl” still works on paginated rows and does not refresh (from M1.2).

---

### Milestone M3 (P2) — Live status updates (polling) and reducing refresh dependence for async actions

> No new dependencies for 16.1.1. Implement polling with `fetch` + `setInterval`.

#### M3.1 Add authenticated status proxy route (dashboard server)

**Create file:** `app/api/dashboard/sites/[siteId]/status/route.ts`

- [ ] Implement `GET` handler that:
  - [ ] Calls `requireDashboardAuth()`
  - [ ] Uses `auth.webhooksAuth!` token
  - [ ] Fetches current `site` via `fetchSite(token, siteId)`
  - [ ] Fetches current `deployments` via `fetchDeployments(token, siteId)`
  - [ ] Returns `NextResponse.json({ site, deployments })`
  - [ ] On `WebhooksApiError` with status 404 → return 404 JSON `{ error: "Not found" }`
  - [ ] On other errors → return 500 JSON `{ error: "Unable to load status" }`

**Acceptance for M3.1:**
- Hitting the route while authenticated returns `{ site, deployments }`.
- Unauthenticated requests are rejected by existing auth behavior.

---

#### M3.2 Implement a generic polling hook (client)

**Create file:** `internal/dashboard/use-poll.ts`

- [ ] Export a hook:

```ts
export function usePoll<T>(options: {
  enabled: boolean;
  intervalMs: number;
  fetcher: () => Promise<T>;
  isTerminal: (value: T) => boolean;
  initial: T;
}): { value: T; error: Error | null; isPolling: boolean }
```

- [ ] Behavior requirements:
  - [ ] Initialize `value` with `options.initial`
  - [ ] If `enabled` is false → do not start interval
  - [ ] If `enabled` is true:
    - [ ] Start an interval every `intervalMs`
    - [ ] On each tick: call `fetcher()`, set `value`
    - [ ] If `isTerminal(value)` becomes true → stop polling
  - [ ] Stop interval on unmount
  - [ ] Store the most recent error in `error` but keep previous `value`

**Acceptance for M3.2:**
- Hook compiles and can be used by client components.
- Polling stops when `isTerminal` returns true.

---

#### M3.3 Convert Crawl Summary card to a live-updating client component

**Goal:** After triggering a crawl, the status card updates without `router.refresh()`.

**Create file:** `app/dashboard/sites/[id]/pages/crawl-summary.client.tsx` (or `/components/dashboard/...`), with `"use client";` at top.

- [ ] Props MUST include:
  - [ ] `siteId: string`
  - [ ] `initialSite: Site` (import type from `@internal/dashboard/webhooks`)
  - [ ] The i18n labels used by the existing crawl summary card (pass through from the server page; do not re-resolve i18n client-side in 16.1.1)
- [ ] In the client component:
  - [ ] Use `usePoll` to poll `/api/dashboard/sites/${siteId}/status` every `3000ms`
  - [ ] Define terminal states for crawl as:
    - [ ] `latestCrawlRun.status` is `"completed"` or `"failed"`, or `latestCrawlRun` is null
  - [ ] Render the existing Crawl Summary markup using the *polled* `site.latestCrawlRun` data

**Server integration:**
- [ ] In `app/dashboard/sites/[id]/pages/page.tsx`, replace the current Crawl Summary card body with the new client component, passing:
  - [ ] `siteId={site.id}`
  - [ ] `initialSite={site}`
  - [ ] all labels currently used in the card

**Acceptance for M3.3:**
- Triggering a crawl updates the crawl status badge from `in_progress` → `completed`/`failed` without a full page refresh.
- The poll stops once a terminal state is reached.

---

#### M3.4 Disable refresh for crawl/translate trigger actions once polling is in place

**Search:**
- [ ] `rg "action=\{triggerCrawlAction\}" app/dashboard -g'*.tsx'`
- [ ] `rg "action=\{translateAndServeAction\}" app/dashboard -g'*.tsx'`

For each matching `<ActionForm>`:
- [ ] Add `refreshOnSuccess={false}`.

**Acceptance for M3.4:**
- Triggering crawl/translate shows toast and does not cause full refresh.
- Status updates are visible via polling (where implemented).

---

### Milestone M4 (P3) — Cache correctness: eliminate stale sidebar/overview data

#### M4.1 Ensure `invalidateSitesCache()` is called in all site/domain/serving mutations

**File:** `app/dashboard/actions.ts` (or the split actions files if refactor is already done)

- [ ] Run `rg "revalidatePath\("/dashboard"\)" app/dashboard/actions.ts`
- [ ] For each action that mutates site-visible state (site create/delete, activate/deactivate, domain verify/provision/refresh, serving status changes):
  - [ ] Ensure it calls `await invalidateSitesCache(auth.webhooksAuth);` exactly once before any `revalidatePath(...)` calls.

**Acceptance for M4.1:**
- After domain verification/provisioning, the sidebar and sites list reflect updated status within the same session (no 10-minute stale cache).

---

### Milestone M5 (P4) — Glossary editor input-lag fix (no stringify-per-keystroke)

#### M5.1 Stop serializing entire glossary JSON on every keystroke

**Files (from reports):**
- `app/dashboard/sites/glossary-table.tsx`
- `app/dashboard/sites/[id]/glossary-editor.tsx`

- [ ] Identify the hidden `<input>` that currently sets `value={JSON.stringify(entries)}` (or equivalent).
- [ ] Change it to an uncontrolled input:
  - [ ] `<input ref={hiddenRef} name="<same-name-as-before>" type="hidden" defaultValue="" />`
- [ ] On form submit (or just before calling the server action):
  - [ ] Set `hiddenRef.current.value = JSON.stringify(entries)`
- [ ] Ensure that:
  - [ ] JSON serialization happens **only** on submit, not on every render.

**Acceptance for M5.1:**
- Typing in glossary inputs no longer causes noticeable input lag on large glossaries.
- Saving still sends the full glossary payload correctly.

---

### Milestone M6 (P5) — Maintainability refactors (optional for 16.1.1; schedule as follow-up)

> These are safe refactors but not required to hit the primary UX outcomes.

#### M6.1 Extract duplicated helpers into shared modules
- [ ] Create `internal/dashboard/format.ts` exporting:
  - [ ] `formatTimestamp(value?: string | null): string`
  - [ ] `formatNextCrawlAt(value: string | null | undefined, eligibleNowLabel: string): string`
  - [ ] `decodeSearchParam(value: string | string[] | undefined): string | null` (only if still used anywhere after M1.3)
- [ ] Create `internal/dashboard/status.ts` exporting:
  - [ ] `resolveServingStatusVariant(...)`
  - [ ] `resolveCrawlStatusVariant(...)`
  - [ ] `resolveDomainStatusVariant(...)`
- [ ] Replace duplicate inline implementations across pages with imports.

#### M6.2 Split `app/dashboard/actions.ts` by domain (reduce merge conflicts)
- [ ] Create directory: `app/dashboard/actions/`
- [ ] Move actions into:
  - [ ] `actions/sites.ts`
  - [ ] `actions/domains.ts`
  - [ ] `actions/crawl.ts`
  - [ ] `actions/translation.ts`
  - [ ] `actions/glossary.ts`
  - [ ] `actions/_utils.ts`
- [ ] Create `actions/index.ts` that re-exports all actions with the original names.
- [ ] Update imports across the dashboard to import from `app/dashboard/actions` (index) so call sites remain stable.

---

## 5. Regression checks & QA script (manual)

After all milestones (or after each milestone incrementally), verify:

- [ ] “Force crawl” does not refresh the full page; scroll position is preserved.
- [ ] No dashboard URL contains `toast=`, `error=`, or `details=` after any action.
- [ ] Pages view pagination works:
  - [ ] page=1 loads
  - [ ] next page loads
  - [ ] previous page loads
- [ ] Trigger crawl:
  - [ ] status shows `in_progress` quickly (either immediately or within 3 seconds)
  - [ ] status updates to `completed`/`failed` automatically
- [ ] Sidebar site list is consistent after domain/serving changes (no stale values).

---

## 6. Codex “execution script” (copy/paste runbook)

> This is a deterministic run order for Codex. It assumes a Unix-like shell.

```bash
set -euo pipefail

# 0) Go to repo root
cd "$(git rev-parse --show-toplevel)"

# 1) Create working branch
git checkout -b dashboard/16.1.1-ux-perf

# 2) Select package manager
if [ -f pnpm-lock.yaml ]; then
  PM=pnpm
elif [ -f yarn.lock ]; then
  PM=yarn
else
  PM=npm
fi

# 3) Install deps
if [ "$PM" = "pnpm" ]; then pnpm install
elif [ "$PM" = "yarn" ]; then yarn install --frozen-lockfile
else npm ci
fi

# 4) Baseline checks (ignore missing scripts; run what exists)
npm run -s lint || true
npm run -s typecheck || true
npm run -s test || true
npm run -s build || true

# -------------------------------------------------------------------
# Milestone M1
# -------------------------------------------------------------------

# M1.1 ActionForm refresh control
$EDITOR components/dashboard/action-form.tsx

# M1.2 Disable refresh on per-row Force crawl
$EDITOR app/dashboard/sites/[id]/pages/page.tsx

# M1.3 Remove URL toast/error banners
rg "searchParams\?: Promise<\{\s*toast\?:" app/dashboard -g'*.tsx' || true
rg "decodeSearchParam\(" app/dashboard -g'*.tsx' || true
rg "\?toast=|\?error=|&toast=|&error=" app/dashboard internal components -g'*.ts*' || true
# Edit each matching file and delete banner/searchParam logic.

# Re-run checks
npm run -s lint || true
npm run -s typecheck || true
npm run -s build || true

# -------------------------------------------------------------------
# Milestone M2
# -------------------------------------------------------------------

# M2.1 Backend pagination (if worker repo exists in this checkout)
if [ -f workers/webhooks-worker/src/handlers/sites.ts ]; then
  $EDITOR workers/webhooks-worker/src/handlers/sites.ts
fi

# M2.2 Update fetchSitePages wrapper
$EDITOR internal/dashboard/webhooks.ts

# M2.3 Update pages UI with pagination controls
$EDITOR app/dashboard/sites/[id]/pages/page.tsx

npm run -s lint || true
npm run -s typecheck || true
npm run -s build || true

# -------------------------------------------------------------------
# Milestone M3
# -------------------------------------------------------------------

# M3.1 Add dashboard proxy route
mkdir -p app/api/dashboard/sites/[siteId]/status
$EDITOR app/api/dashboard/sites/[siteId]/status/route.ts

# M3.2 Add polling hook
mkdir -p internal/dashboard
$EDITOR internal/dashboard/use-poll.ts

# M3.3 Convert Crawl Summary to client component
mkdir -p app/dashboard/sites/[id]/pages
$EDITOR app/dashboard/sites/[id]/pages/crawl-summary.client.tsx
$EDITOR app/dashboard/sites/[id]/pages/page.tsx

# M3.4 Disable refresh on crawl/translate triggers
rg "action=\{triggerCrawlAction\}" app/dashboard -g'*.tsx' || true
rg "action=\{translateAndServeAction\}" app/dashboard -g'*.tsx' || true
# Edit matches: add refreshOnSuccess={false}

npm run -s lint || true
npm run -s typecheck || true
npm run -s build || true

# -------------------------------------------------------------------
# Milestone M4
# -------------------------------------------------------------------

rg "revalidatePath\("/dashboard"\)" app/dashboard/actions.ts || true
$EDITOR app/dashboard/actions.ts
npm run -s typecheck || true

# -------------------------------------------------------------------
# Milestone M5
# -------------------------------------------------------------------

$EDITOR app/dashboard/sites/glossary-table.tsx
$EDITOR app/dashboard/sites/[id]/glossary-editor.tsx
npm run -s typecheck || true

# -------------------------------------------------------------------
# Finalize
# -------------------------------------------------------------------

git status
git diff

# Optional: run tests if they exist
npm run -s test || true

git commit -am "Dashboard 16.1.1 UX/perf: explicit refresh, remove URL toasts, pagination, polling"
```

---

## 7. Notes / explicit non-goals for 16.1.1
- Do **not** introduce SWR or React Query in this release.
- Do **not** add extra keys to strict Zod responses without updating schemas.
- Do **not** attempt a full rewrite of server components; keep changes incremental.
