# Dashboard Code Review — 2026-01-08

**Reviewer:** Claude Opus 4.5  
**Scope:** `/app/dashboard/**`, `/internal/dashboard/**`, `/components/dashboard/**`  
**Focus:** Performance issues, unnecessary page reloads, architecture, and UX decisions

---

## Executive Summary

The WebLingo dashboard is functional but suffers from several fundamental architectural decisions that cause:

1. **Aggressive full-page reloads** after almost every user action
2. **Duplicate data fetching** across layout and pages
3. **Monolithic components** with 700–1000+ lines mixing concerns
4. **Poor state management** that forces server round-trips for UI state changes
5. **Sub-optimal UX patterns** including URL-based toast messages and blocking navigations

This review provides a detailed analysis of each issue with specific code references and actionable recommendations.

---

## Table of Contents

1. [Critical: Forced Page Reloads on Every Action](#1-critical-forced-page-reloads-on-every-action)
2. [Critical: Duplicate Data Fetching](#2-critical-duplicate-data-fetching)
3. [Major: Monolithic Server Components](#3-major-monolithic-server-components)
4. [Major: Massive Actions File](#4-major-massive-actions-file)
5. [Major: URL-Based Toast Messages](#5-major-url-based-toast-messages)
6. [Moderate: Workspace Switching Full Reload](#6-moderate-workspace-switching-full-reload)
7. [Moderate: Aggressive Cache Invalidation](#7-moderate-aggressive-cache-invalidation)
8. [Moderate: Code Duplication](#8-moderate-code-duplication)
9. [Minor: Client/Server Boundary Inefficiencies](#9-minor-clientserver-boundary-inefficiencies)
10. [Minor: Missing Loading States](#10-minor-missing-loading-states)
11. [Recommendations Summary](#recommendations-summary)
12. [Prioritized Action Plan](#prioritized-action-plan)

---

## 1. Critical: Forced Page Reloads on Every Action

### Problem

The `ActionForm` component unconditionally calls `router.refresh()` after every successful server action:

```typescript
// components/dashboard/action-form.tsx:45-57
useEffect(() => {
  if (wasPending.current && !pending && state.ok) {
    const redirectTo = typeof state.meta?.redirectTo === "string" ? state.meta.redirectTo : null;
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh(); // ← ALWAYS TRIGGERS FULL PAGE REFRESH
    }
    onSuccess?.(state);
  }
  wasPending.current = pending;
}, [pending, state, router, onSuccess]);
```

### Impact

- **Every button click** that uses `ActionForm` (which is nearly all dashboard actions) triggers a full Next.js route refresh
- Users see a flash/jank as the entire page re-renders
- All server components re-execute, including layout data fetches
- On slow connections, this creates 1–3 second delays after each action
- User scroll position, form focus, and UI context are lost

### Affected Actions (20+ actions in `actions.ts`)

- `triggerCrawlAction`
- `translateAndServeAction`
- `verifyDomainAction`
- `updateGlossaryAction`
- `createOverrideAction`
- `updateSlugAction`
- `updateSiteStatusAction`
- `setLocaleServingAction`
- `deactivateSiteAction`
- `activateSiteAction`
- And 10+ more...

### Root Cause

The architecture assumes server-side rendering must re-run to reflect state changes. There's no:

- Optimistic UI updates
- Client-side state management
- Selective revalidation

### Recommendation

1. **Use optimistic updates** for immediate feedback
2. **Replace `router.refresh()`** with targeted `mutate()` calls (SWR) or React Query
3. **Return updated data from server actions** and merge into client state
4. **Consider React Server Actions with `useOptimistic`** for immediate UI feedback

---

## 2. Critical: Duplicate Data Fetching

### Problem

The same data is fetched multiple times per page load:

**Layout fetches sites:**

```typescript
// app/dashboard/layout.tsx:246-258
async function SitesNavSection({ auth }: { auth: DashboardAuth }) {
  let sites: Site[] = [];
  try {
    sites = await listSitesCached(auth.webhooksAuth!);
  }
  // ...
}
```

**And again in SitesUsageSummary:**

```typescript
// app/dashboard/layout.tsx:265-287
async function SitesUsageSummary({ auth, isAgency }: {...}) {
  // ...
  const sites = await listSitesCached(auth.webhooksAuth!);  // ← DUPLICATE
  // ...
}
```

**And again in page.tsx:**

```typescript
// app/dashboard/page.tsx:21-23
const auth = await requireDashboardAuth();
sites = await listSitesCached(auth.webhooksAuth!); // ← DUPLICATE
```

**And again in sites/page.tsx:**

```typescript
// app/dashboard/sites/page.tsx:19-21
const auth = await requireDashboardAuth();
sites = await listSitesCached(auth.webhooksAuth!); // ← DUPLICATE
```

### Impact

- `requireDashboardAuth()` is called separately in layout AND every page (2× auth bootstraps)
- `listSitesCached()` is called 2–4 times per page render
- While React's `cache()` dedupes within a single render, the Redis cache lookup + potential API call still runs
- Network waterfall: layout waits for sites → page waits for sites again

### Root Cause

No shared data context between layout and pages. Each component independently fetches what it needs.

### Recommendation

1. **Use React Context or Zustand** to share fetched data between layout and pages
2. **Consolidate auth + sites fetch in layout** and pass via context
3. **Consider parallel data loading** at route level with `generateMetadata` or `loading.tsx`

---

## 3. Major: Monolithic Server Components

### Problem

Individual page components are massive, mixing data fetching, business logic, and UI rendering:

| File                                   | Lines     | Description              |
| -------------------------------------- | --------- | ------------------------ |
| `sites/[id]/page.tsx`                  | 724 lines | Site configuration page  |
| `sites/[id]/admin/page.tsx`            | 970 lines | Site admin/settings page |
| `sites/[id]/pages/page.tsx`            | 527 lines | Pages list               |
| `dashboard/layout.tsx`                 | 385 lines | Main layout              |
| `sites/[id]/admin/site-admin-form.tsx` | 654 lines | Single form component    |

### Example: `sites/[id]/page.tsx`

```typescript
// This single file contains:
// 1. Route params handling
// 2. Search params parsing
// 3. Auth verification
// 4. 3 parallel API calls
// 5. Error handling for each
// 6. Complex UI logic (domain locale lookup, deployment mapping)
// 7. 10+ local helper functions
// 8. Large JSX with nested conditions
// 9. ~400 lines of inline JSX for DomainSection
```

### Impact

- Hard to understand, test, and maintain
- Changes risk breaking unrelated functionality
- No code reuse between similar pages
- Long render times as entire component tree re-executes

### Root Cause

Organic growth without refactoring. Each feature was added inline rather than extracted.

### Recommendation

1. **Extract data fetching into dedicated hooks/utilities**
2. **Create smaller, focused components** (e.g., `DomainCard`, `DeploymentRow`)
3. **Use colocation** — keep related files together but separate concerns
4. **Apply the 200-line rule** — any component > 200 lines should be reviewed for extraction

---

## 4. Major: Massive Actions File

### Problem

`app/dashboard/actions.ts` is 992 lines with 20+ server actions:

```typescript
// actions.ts contains:
// - createSiteAction (117 lines)
// - updateSiteSettingsAction (45 lines)
// - triggerCrawlAction (30 lines)
// - translateAndServeAction (48 lines)
// - cancelTranslationRunAction (26 lines)
// - resumeTranslationRunAction (28 lines)
// - retryFailedTranslationRunAction (26 lines)
// - triggerPageCrawlAction (29 lines)
// - verifyDomainAction (42 lines)
// - provisionDomainAction (39 lines)
// - refreshDomainAction (38 lines)
// - updateGlossaryAction (40 lines)
// - createOverrideAction (30 lines)
// - updateSlugAction (28 lines)
// - updateSiteStatusAction (36 lines)
// - setLocaleServingAction (35 lines)
// - deactivateSiteAction (28 lines)
// - deleteSiteAction (32 lines)
// - activateSiteAction (28 lines)
// + 10 helper functions (213 lines)
```

### Impact

- Cognitive overload when debugging
- High risk of merge conflicts
- Hard to find specific action logic
- All actions share error handling patterns but with subtle differences

### Root Cause

Single file for "all dashboard actions" without domain separation.

### Recommendation

1. **Split by domain:**
   - `actions/sites.ts` — site CRUD
   - `actions/crawl.ts` — crawl triggers
   - `actions/translation.ts` — translation runs
   - `actions/domains.ts` — domain verification
   - `actions/glossary.ts` — glossary/overrides
2. **Extract shared utilities** to `actions/utils.ts`
3. **Co-locate actions with their UI** (e.g., `sites/[id]/actions.ts`)

---

## 5. Major: URL-Based Toast Messages

### Problem

Toast/error messages are passed via URL search params:

```typescript
// sites/[id]/page.tsx:46-51
const toastMessage = decodeSearchParam(resolvedSearchParams?.toast);
const actionErrorMessage = decodeSearchParam(resolvedSearchParams?.error);
const actionErrorDetails = decodeSearchParam(resolvedSearchParams?.details);
```

```tsx
// sites/[id]/page.tsx:175-196
{actionErrorMessage ? (
  <div className="rounded-md border border-destructive/40 ...">
    <span>{actionErrorMessage}</span>
    <Link className="font-medium underline" href={`/dashboard/sites/${id}`}>
      Dismiss
    </Link>  {/* ← CLICKING DISMISS TRIGGERS PAGE RELOAD */}
  </div>
) : toastMessage ? (
  <div className="...">
    {toastMessage}{" "}
    <Link ... href={`/dashboard/sites/${id}`}>
      Dismiss
    </Link>  {/* ← ANOTHER PAGE RELOAD */}
  </div>
) : null}
```

### Impact

- Dismissing a toast triggers a full page navigation
- URL changes pollute browser history
- Toast state is lost on manual refresh
- Inconsistent with the toast system (`sonner`) already in use

### Root Cause

Legacy pattern from before `useActionToast` was implemented. The URL approach was simpler for server-rendered pages.

### Recommendation

1. **Use `sonner` (already installed) exclusively for all toasts**
2. **Remove URL-based toast handling** — already using `useActionToast` in forms
3. **Let `useActionToast` handle all success/error states**

---

## 6. Moderate: Workspace Switching Full Reload

### Problem

Switching workspaces triggers a full-page redirect:

```typescript
// _lib/workspace-actions.ts:33-50
if (!subjectAccountId || subjectAccountId === actorId) {
  const cookieStore = await cookies();
  cookieStore.delete(SUBJECT_ACCOUNT_COOKIE);
  redirect(redirectTo);  // ← FULL PAGE REDIRECT
}

// ...

cookieStore.set(SUBJECT_ACCOUNT_COOKIE, subjectAccountId, {...});
redirect(redirectTo);  // ← FULL PAGE REDIRECT
```

```typescript
// _components/workspace-switcher.tsx:37
onChange={() => formRef.current?.requestSubmit()}  // ← TRIGGERS REDIRECT
```

### Impact

- User sees full page flash on workspace switch
- All data is re-fetched from scratch
- 1–2 second delay on workspace change
- Feels like navigating to a different site

### Root Cause

Auth context is tied to cookies, requiring a full page reload to pick up new context.

### Recommendation

1. **Consider client-side auth context** that can be updated without redirect
2. **Pre-fetch workspace data** in the background
3. **Use optimistic UI** — switch UI immediately, then validate
4. **At minimum, use `router.replace()` instead of redirect** to avoid history pollution

---

## 7. Moderate: Aggressive Cache Invalidation

### Problem

Server actions call `revalidatePath()` for multiple paths, even when unnecessary:

```typescript
// actions.ts:309-313 (createSiteAction)
await invalidateSitesCache(auth.webhooksAuth);
revalidatePath("/dashboard");
revalidatePath("/dashboard/sites");
revalidatePath(`/dashboard/sites/${site.id}`);
```

```typescript
// actions.ts:359-363 (updateSiteSettingsAction)
await invalidateSitesCache(auth.webhooksAuth);
revalidatePath("/dashboard");
revalidatePath("/dashboard/sites");
revalidatePath(`/dashboard/sites/${siteId}`);
revalidatePath(`/dashboard/sites/${siteId}/admin`);
```

This pattern repeats in nearly every action.

### Impact

- Multiple paths are invalidated per action
- Combined with `router.refresh()`, this triggers extensive re-rendering
- Cache is blown away even for unrelated pages
- No granular control over what actually changed

### Root Cause

Defensive invalidation — "if anything might have changed, invalidate everything."

### Recommendation

1. **Invalidate only affected paths** based on what the action actually modifies
2. **Use tags-based revalidation** (`revalidateTag()`) for more granular control
3. **Consider removing `revalidatePath()` entirely** if using client-side state updates

---

## 8. Moderate: Code Duplication

### Problem

Several patterns are duplicated across files:

### 8.1 `decodeSearchParam` function (duplicated 4×)

```typescript
// Identical implementation in:
// - sites/[id]/page.tsx:259-273
// - sites/[id]/admin/page.tsx:853-867
// - sites/[id]/pages/page.tsx:449-463
// - sites/[id]/overrides/page.tsx:228-242
```

### 8.2 `formatTimestamp` function (duplicated 3×)

```typescript
// Identical implementation in:
// - sites/[id]/page.tsx:292-301
// - sites/[id]/admin/page.tsx (inline)
// - sites/[id]/pages/page.tsx:465-474
```

### 8.3 Serving status badge resolution (duplicated 3×)

```typescript
// resolveServingStatusVariant() duplicated in:
// - sites/[id]/admin/page.tsx:943-956
// - sites/[id]/pages/page.tsx:490-502
// - Similar logic inline in page.tsx
```

### 8.4 Domain status badge resolution (duplicated 2×)

```typescript
// resolveDomainStatusVariant() duplicated in:
// - sites/[id]/admin/page.tsx:959-969
// - sites/[id]/pages/page.tsx:516-526
```

### Impact

- Bug fixes need to be applied in multiple places
- Inconsistency risk if implementations drift
- Wasted code/bundle size
- Maintenance burden

### Recommendation

1. **Extract to `internal/dashboard/format.ts`:**
   - `decodeSearchParam()`
   - `formatTimestamp()`
   - `formatNextCrawlAt()`
2. **Extract to `internal/dashboard/status.ts`:**
   - `resolveServingStatusVariant()`
   - `resolveDomainStatusVariant()`
   - `resolveCrawlStatusVariant()`

---

## 9. Minor: Client/Server Boundary Inefficiencies

### Problem

### 9.1 Excessive prop drilling of i18n strings

```typescript
// sites/[id]/page.tsx:56-77
const { t } = await resolveLocaleTranslator(...);
const deactivateLabel = t("dashboard.site.status.deactivate");
const reactivateLabel = t("dashboard.site.status.reactivate");
const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
const activateHelp = t("dashboard.site.status.activateHelp");
const cloudflareStatusHelpLabel = t("dashboard.domains.cloudflare.helpLabel");
// ... 15+ more translations

// Then passed as props:
<SiteHeader
  deactivateLabel={deactivateLabel}
  reactivateLabel={reactivateLabel}
  deactivateConfirm={deactivateConfirm}
  activateHelpLabel={activateHelpLabel}
  activateHelp={activateHelp}
/>
```

This pattern repeats on every page with 10–30 translation props each.

### 9.2 Components that could be server components

```typescript
// sites-nav.tsx is "use client" but only uses:
// - usePathname() — could be passed as prop
// - useState() — for expand/collapse, could use CSS-only solution
```

### Impact

- Large prop objects passed through component tree
- Increased hydration payload
- Client components where server components would suffice

### Recommendation

1. **Use `next-intl` or similar** with client-side translation context
2. **Move translations to a provider** instead of prop drilling
3. **Evaluate each `"use client"` component** for potential server rendering

---

## 10. Minor: Missing Loading States

### Problem

No granular loading indicators:

```typescript
// layout.tsx:151-154
<Suspense fallback={<SitesNavFallback />}>
  <SitesNavSection auth={auth} />
</Suspense>
```

The fallback is a simple text:

```typescript
// layout.tsx:261-263
function SitesNavFallback() {
  return <div className="px-2 py-2 text-xs ...">Loading sites...</div>;
}
```

Pages like `sites/[id]/page.tsx` have no loading states — the entire page is blocked until all 3 API calls complete.

### Impact

- Users see blank/stale content while data loads
- No progressive enhancement
- Perceived performance is poor even if actual performance is acceptable

### Recommendation

1. **Add Suspense boundaries** around each Card/section
2. **Create skeleton components** for tables and cards
3. **Use `loading.tsx` files** for route-level loading states
4. **Implement streaming** with React Server Components

---

## Recommendations Summary

| Priority | Issue                                              | Effort | Impact    |
| -------- | -------------------------------------------------- | ------ | --------- |
| P0       | Replace `router.refresh()` with optimistic updates | High   | Very High |
| P0       | Consolidate data fetching to avoid duplicates      | Medium | High      |
| P1       | Split monolithic components                        | Medium | Medium    |
| P1       | Organize actions by domain                         | Low    | Medium    |
| P1       | Remove URL-based toasts                            | Low    | Medium    |
| P2       | Extract duplicated utilities                       | Low    | Low       |
| P2       | Optimize cache invalidation                        | Medium | Medium    |
| P2       | Add skeleton loading states                        | Medium | Medium    |
| P3       | Reduce prop drilling for i18n                      | Medium | Low       |
| P3       | Audit client/server boundaries                     | Low    | Low       |

---

## Prioritized Action Plan

### Phase 1: Stop the Bleeding (1–2 weeks)

1. **Modify `ActionForm` to not call `router.refresh()` by default**
   - Add `refreshOnSuccess` prop, default to `false`
   - Update callers that genuinely need refresh
   - Use `onSuccess` callback for targeted updates

2. **Remove URL-based toast handling**
   - Remove `toast`/`error`/`details` query param parsing
   - Rely on existing `useActionToast` hook
   - Remove "Dismiss" links that trigger reloads

3. **Extract duplicated utilities**
   - Create `internal/dashboard/format.ts`
   - Create `internal/dashboard/status.ts`
   - Update imports across all files

### Phase 2: Structural Improvements (2–3 weeks)

4. **Split `actions.ts` by domain**
   - Create `actions/` directory
   - Group related actions
   - Export from index for backwards compatibility

5. **Add React Context for shared data**
   - Create `DashboardDataContext`
   - Load sites + auth once in layout
   - Provide to all dashboard pages

6. **Add loading states**
   - Create skeleton components
   - Add `loading.tsx` for key routes
   - Wrap expensive sections in Suspense

### Phase 3: Component Refactoring (3–4 weeks)

7. **Break down large page components**
   - Extract `DomainSection` to separate file
   - Extract `DeploymentsTable` to separate file
   - Create shared `PageShell` for common patterns

8. **Refactor `SiteAdminForm`**
   - Split into section components
   - Use form library (react-hook-form) for state
   - Reduce from 654 lines to ~200

9. **Optimize workspace switching**
   - Consider client-side auth refresh
   - Add loading indicator during switch
   - Pre-fetch workspace data

---

## Appendix: File Sizes and Complexity

| File                                   | Lines | Functions | Concerns |
| -------------------------------------- | ----- | --------- | -------- |
| `actions.ts`                           | 992   | 30        | 5+       |
| `sites/[id]/admin/page.tsx`            | 970   | 15        | 6+       |
| `sites/[id]/page.tsx`                  | 724   | 12        | 5+       |
| `sites/[id]/admin/site-admin-form.tsx` | 654   | 3         | 4+       |
| `sites/[id]/pages/page.tsx`            | 527   | 10        | 4+       |
| `internal/dashboard/webhooks.ts`       | 916   | 25        | 2        |
| `dashboard/layout.tsx`                 | 385   | 10        | 4+       |
| `internal/dashboard/auth.ts`           | 373   | 8         | 2        |

Files over 300 lines should be reviewed for extraction opportunities.

---

## Appendix A: Cross-Report Coherence Notes

_Based on analyst consolidation of this report with GPT and Gemini reports._

### Confirmed Coherent Across All Reports (✅)

| Item                         | Status                                |
| ---------------------------- | ------------------------------------- |
| `ActionForm` source code     | Identical across reports              |
| `ActionResponse` type        | Consistent: `{ ok, message, meta? }`  |
| Per-row `ActionForm` pattern | Confirmed with real file reference    |
| `fetchSitePages` contract    | Confirmed: unpaginated, strict schema |
| Dependency status            | No SWR/React Query; `sonner` present  |

### Incoherent / Uncertain Items (⚠️)

**1. Next.js Version**

- One report assumed Next.js 15
- Actual from `package.json`: **`next: "16.1.1"`**

**Correction:** This report's recommendations are based on the actual version. Codex should use `package.json` as source of truth.

**2. Scale / p95 Numbers**

- Reports disagree (200 vs 500–1000 pages p95)
- **Resolution:** Implement pagination + avoid per-row client forms regardless of scale. These fixes are correct even at 100 pages.

---

### Implementation Constraints Confirmed

1. **`listSitePagesResponseSchema` uses `.strict()`** — Backend response shape MUST remain exactly `{ pages: [...] }`. Adding keys would break strict Zod decoding.

2. **`meta` field is safe to extend** — `ActionResponse.meta` is `Record<string, unknown>`, so adding `meta.refresh` is backwards compatible.

3. **Default behavior must be preserved** — When adding `refreshOnSuccess` prop, default should be `true` to maintain existing behavior until call sites are migrated.

---

## Appendix B: Artifacts for Implementation Validation

_This section provides the exact source code and data contracts requested by the implementation analyst to enable unambiguous Codex implementation._

---

### B.1 Full Source of `components/dashboard/action-form.tsx`

```typescript
"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { ActionResponse } from "@/app/dashboard/actions";
import { useActionToast } from "@internal/dashboard/use-action-toast";

type ActionFormProps = {
  action: (prevState: ActionResponse | undefined, formData: FormData) => Promise<ActionResponse>;
  loading: string;
  success: string;
  error: string;
  confirmMessage?: string;
  className?: string;
  onSuccess?: (state: ActionResponse) => void;
  children: ReactNode;
};

const initialState: ActionResponse = { ok: false, message: "" };

export function ActionForm({
  action,
  loading,
  success,
  error,
  confirmMessage,
  className,
  onSuccess,
  children,
}: ActionFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading,
    success,
    error,
  });
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      const redirectTo =
        typeof state.meta?.redirectTo === "string" ? state.meta.redirectTo : null;
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
      onSuccess?.(state);
    }
    wasPending.current = pending;
  }, [pending, state, router, onSuccess]);

  return (
    <form
      action={submitWithToast}
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
```

**File location:** `/components/dashboard/action-form.tsx` (76 lines total)

---

### B.2 `ActionResponse` Type Definition

**Location:** `app/dashboard/actions.ts` (lines 37-41)

```typescript
export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};
```

**Helper constructors (same file, lines 43-53):**

```typescript
const failed = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: false,
  message,
  meta,
});

const succeeded = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: true,
  message,
  meta,
});
```

**Example response payloads from actual actions:**

```typescript
// Success with redirect (deleteSiteAction, line 951)
return succeeded("Site deleted.", { redirectTo: "/dashboard/sites" });

// Success with metadata (createSiteAction, lines 315-319)
return succeeded("Site created. Verify domains and activate to start crawling.", {
  siteId: site.id,
  crawlStatus: site.crawlStatus,
  toast: toast ?? undefined,
});

// Success simple (triggerCrawlAction, line 394)
return succeeded("Crawl enqueued.");

// Failure simple (line 384-385)
return failed("Site ID is required.");

// Failure with context (line 273)
return failed(formatBillingBlockMessage(auth, "create new sites"));
```

---

### B.3 Representative Page File with Per-Row Actions

**File:** `app/dashboard/sites/[id]/pages/page.tsx` (527 lines)

**Per-row action pattern (lines 407-434):**

```typescript
{pages.map((page) => (
  <tr key={page.id} className="border-t border-border/50">
    <td className="px-3 py-3 align-top">
      <span className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
        {page.sourcePath}
      </span>
    </td>
    <td className="px-3 py-3 align-top text-muted-foreground">
      {formatTimestamp(page.lastCrawledAt)}
    </td>
    <td className="px-3 py-3 align-top text-muted-foreground">
      {formatTimestamp(page.lastSnapshotAt)}
    </td>
    <td className="px-3 py-3 align-top text-muted-foreground">
      {formatNextCrawlAt(page.nextCrawlAt, eligibleNowLabel)}
    </td>
    {canCrawl ? (
      <td className="px-3 py-3 text-right align-top">
        <ActionForm
          action={triggerPageCrawlAction}
          loading="Starting page crawl..."
          success="Page crawl enqueued."
          error="Unable to enqueue page crawl."
        >
          <>
            <input name="siteId" type="hidden" value={site.id} />
            <input name="pageId" type="hidden" value={page.id} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!crawlReady || pageCrawlLimitReached}
              title={...}
            >
              Force crawl
            </Button>
          </>
        </ActionForm>
      </td>
    ) : null}
  </tr>
))}
```

**Key observation:** Each row renders its own `<ActionForm>` component instance, meaning:

- N rows = N `useActionState` hooks
- N rows = N `useActionToast` hooks
- N rows = N `useRouter` instances
- All hydrated on page load

---

### B.4 API Contract for `fetchSitePages`

**Location:** `internal/dashboard/webhooks.ts` (lines 836-844)

```typescript
export async function fetchSitePages(auth: AuthInput, siteId: string): Promise<SitePageSummary[]> {
  const data = await request({
    path: `/sites/${siteId}/pages`,
    auth,
    schema: listSitePagesResponseSchema,
  });

  return data.pages;
}
```

**Request:**

- Method: `GET`
- Path: `/sites/{siteId}/pages`
- Auth: Bearer token in Authorization header
- **No pagination parameters currently supported**

**Response schema (lines 136-144, 222-226):**

```typescript
const sitePageSummarySchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  lastSeenAt: z.string().nullable().optional(),
  lastCrawledAt: z.string().nullable().optional(),
  lastSnapshotAt: z.string().nullable().optional(),
  nextCrawlAt: z.string().nullable().optional(),
  lastVersionAt: z.string().nullable().optional(),
});

const listSitePagesResponseSchema = z
  .object({
    pages: z.array(sitePageSummarySchema),
  })
  .strict();
```

**TypeScript type:**

```typescript
export type SitePageSummary = {
  id: string;
  sourcePath: string;
  lastSeenAt?: string | null;
  lastCrawledAt?: string | null;
  lastSnapshotAt?: string | null;
  nextCrawlAt?: string | null;
  lastVersionAt?: string | null;
};
```

**Current behavior:**

- Returns ALL pages for a site in a single response
- No `limit`, `cursor`, or `offset` parameters
- No server-side filtering/search

---

### B.5 Typical Scale Numbers

**Note:** These are estimates based on code inspection and typical SaaS usage patterns. Actual p95 values should be verified from production logs/metrics.

| Metric                    | Typical | p95 Estimate | Maximum Observed                    |
| ------------------------- | ------- | ------------ | ----------------------------------- |
| Pages per site            | 10-50   | ~200         | 1,000+ possible                     |
| Domains per site          | 2-5     | ~10          | Bounded by target languages         |
| Target languages per site | 1-3     | ~5           | `maxLocales` plan limit (varies)    |
| Glossary entries per site | 0-20    | ~100         | Plan-limited (`maxGlossarySources`) |
| Sites per account         | 1-3     | ~10          | `maxSites` plan limit (varies)      |

**Evidence from code:**

- `maxLocales` checked in `createSiteAction` (line 281): can be null (unlimited) or a plan-based limit
- `maxSites` checked in multiple places for slot enforcement
- `maxGlossarySources` mentioned in feature flags but not visibly enforced in glossary UI

**Pages list is the primary scalability concern** — no pagination means a site with 500 pages sends a large JSON payload and renders 500 `<ActionForm>` instances.

---

### B.6 SWR / React Query Dependency Status

**Neither SWR nor React Query is currently installed.**

Verified from `package.json`:

```json
{
  "dependencies": {
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-slot": "^1.1.0",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.89.0",
    "@upstash/redis": "^1.36.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "lucide-react": "^0.562.0",
    "next": "16.1.1",
    "posthog-js": "^1.313.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "sonner": "^2.0.7",
    "stripe": "^19.2.0",
    "tailwind-merge": "^2.5.4",
    "zod": "^3.23.8"
  }
}
```

**Implication for implementation:**

- Adding SWR or React Query requires a new dependency
- Alternative: use React 19's `use()` hook + manual cache, or `useOptimistic` for immediate feedback
- Polling can be implemented with `useEffect` + `setInterval` without additional dependencies

---

### B.7 Additional Context: `useActionToast` Hook

**Location:** `internal/dashboard/use-action-toast.ts` (86 lines)

This hook is already used by `ActionForm` and provides toast feedback via `sonner`:

```typescript
export function useActionToast<T extends ActionResult>(options: {
  formAction: (formData: FormData) => void;
  state: T;
  pending: boolean;
  loading: string;
  success: string;
  error: string;
}): (formData: FormData) => void {
  // Uses toast.promise() from sonner
  // Shows loading → success/error based on state.ok
  // Returns the formAction for use in form action prop
}
```

**Key behavior:**

- Creates a `toast.promise()` when `pending` becomes true
- Resolves/rejects the promise when `pending` becomes false based on `state.ok`
- Already handles success/error feedback without URL params
- The URL-based toast pattern (`?toast=...`) is redundant legacy code

---

## Appendix C: Codex-Ready Implementation Spec

_Consolidated from analyst review of this report + GPT + Gemini reports. Written to avoid interpretation._

---

### Phase P0 — Remove Unnecessary Full Route Refreshes

#### P0.1 Refactor `ActionForm` to Make Refresh Explicit (Backwards Compatible)

**File:** `components/dashboard/action-form.tsx`

**Step 1:** Add new optional prop to `ActionFormProps`:

```typescript
refreshOnSuccess?: boolean;
```

**Step 2:** Replace the success effect body with:

```tsx
useEffect(() => {
  if (wasPending.current && !pending && state.ok) {
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

    const shouldRefresh = refreshOnSuccess ?? metaRefresh ?? true;

    if (shouldRefresh) {
      router.refresh();
    }
  }

  wasPending.current = pending;
}, [pending, state, router, onSuccess, refreshOnSuccess]);
```

**Acceptance criteria:**

- Existing call sites behave the same (still refresh by default)
- Call sites can opt out via `refreshOnSuccess={false}`
- Actions can opt out via `meta: { refresh: false }`

---

#### P0.2 Disable Refresh for Per-Row "Force Crawl" Action

**File:** `app/dashboard/sites/[id]/pages/page.tsx`

**Change:**

```tsx
<ActionForm
  action={triggerPageCrawlAction}
  loading="Starting page crawl..."
  success="Page crawl enqueued."
  error="Unable to enqueue page crawl."
  refreshOnSuccess={false}  // ← ADD THIS
>
```

**Acceptance criteria:**

- "Force crawl" shows toast, does NOT re-render entire route
- No URL change, no scroll reset

---

#### P0.3 Remove URL-Based Toast/Error Banners

**Files to modify:**

- `app/dashboard/sites/[id]/page.tsx`
- `app/dashboard/sites/[id]/admin/page.tsx`
- `app/dashboard/sites/[id]/pages/page.tsx`
- `app/dashboard/sites/[id]/overrides/page.tsx`

**Delete in each file:**

1. The toast/error banner JSX block:
   ```tsx
   {actionErrorMessage ? ( ... Dismiss Link ... ) : toastMessage ? ( ... Dismiss Link ... ) : null}
   ```
2. Related variables: `resolvedSearchParams`, `toastMessage`, `actionErrorMessage`, `returnTo`
3. The `decodeSearchParam` function (if unused after removal)
4. Update page props type to remove `toast`/`error` if no longer used

**Acceptance criteria:**

- Success/error feedback exclusively via `sonner` toasts
- Dismissing notifications never triggers navigation

---

### Phase P1 — Pagination for Pages List

#### P1.1 Backend: Add Pagination to Webhooks API

**Endpoint:** `GET /sites/{siteId}/pages`

**New query params:**

- `limit` (integer, default 50, clamp to [1, 200])
- `offset` (integer, default 0)

**Response shape MUST remain:**

```json
{ "pages": [ ... ] }
```

**Critical:** Do NOT add extra keys — `listSitePagesResponseSchema` uses `.strict()`.

---

#### P1.2 Update Dashboard Wrapper

**File:** `internal/dashboard/webhooks.ts`

**Change signature:**

```typescript
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

---

#### P1.3 Update Pages UI with Pagination

**File:** `app/dashboard/sites/[id]/pages/page.tsx`

**Logic:**

```typescript
const pageParam = Array.isArray(resolvedSearchParams?.page)
  ? resolvedSearchParams?.page[0]
  : resolvedSearchParams?.page;

const pageNumber = Math.max(1, Number(pageParam ?? "1") || 1);
const pageSize = 50;
const offset = (pageNumber - 1) * pageSize;
const requestedLimit = pageSize + 1; // Request one extra to detect hasNextPage

// Fetch
const allPages = await fetchSitePages(authToken, id, { limit: requestedLimit, offset });

// Determine pagination state
const hasNextPage = allPages.length > pageSize;
const visiblePages = hasNextPage ? allPages.slice(0, pageSize) : allPages;
```

**Render pager controls:**

- Previous link if `pageNumber > 1`
- Next link if `hasNextPage`
- Links set `?page=N` only

---

### Phase P2 — Long-Running Job Polling

#### P2.1 Add Dashboard API Route for Job Status

**Create:** `app/api/dashboard/sites/[siteId]/status/route.ts`

- Uses `requireDashboardAuth()`
- Calls Webhooks API for crawl/translate run status
- Returns minimal status payload

#### P2.2 Create Client Polling Hook

**Create:** `internal/dashboard/use-poll.ts`

- Poll every 3 seconds while status is `in_progress`/`running`
- Stop on terminal states (`completed`, `failed`, `cancelled`)

#### P2.3 Convert Status Cards to Client Components

- Receive initial server data as props
- Poll and update badges in place
- Disable refresh for `triggerCrawlAction` and `translateAndServeAction`

---

### Phase P3 — Cache Invalidation Correctness

**Ensure `invalidateSitesCache(auth.webhooksAuth)` is called for:**

- Site status changes (active/inactive)
- Domain verification/provisioning
- Serving status changes
- Site creation/deletion

---

### Phase P4 — Maintainability Refactors

#### P4.1 Extract Duplicated Utilities

**Create `internal/dashboard/format.ts`:**

- `formatTimestamp(value?: string | null): string`
- `formatNextCrawlAt(value: string | null | undefined, eligibleNowLabel: string): string`

**Create `internal/dashboard/status.ts`:**

- `resolveServingStatusVariant()`
- `resolveCrawlStatusVariant()`
- `resolveDomainStatusVariant()`

#### P4.2 Split `actions.ts` by Domain

**Target structure:**

- `app/dashboard/actions/index.ts` (re-export)
- `app/dashboard/actions/sites.ts`
- `app/dashboard/actions/domains.ts`
- `app/dashboard/actions/crawl.ts`
- `app/dashboard/actions/translation.ts`
- `app/dashboard/actions/glossary.ts`
- `app/dashboard/actions/_utils.ts`

---

---

## Appendix D: Implementation Checklist with Milestones

_Atomic tasks with checkboxes for tracking progress. Tasks are explicit and not subject to interpretation._

---

### Milestone P0: Stop Unnecessary Route Refreshes

**Goal:** Eliminate full-page refresh jank after dashboard actions.

#### P0.1 — Refactor `ActionForm` to Make Refresh Explicit

- [ ] **P0.1.1** Open `components/dashboard/action-form.tsx`
- [ ] **P0.1.2** Add `refreshOnSuccess?: boolean` to `ActionFormProps` type definition
- [ ] **P0.1.3** Add `refreshOnSuccess` to the destructured props in function signature
- [ ] **P0.1.4** Replace the `useEffect` body with the new logic (see Appendix C for exact code)
- [ ] **P0.1.5** Add `refreshOnSuccess` to the `useEffect` dependency array
- [ ] **P0.1.6** Verify existing call sites still work (default behavior preserved)
- [ ] **P0.1.7** Run `pnpm check` to ensure no type errors

**Acceptance:** Existing call sites refresh by default. New prop allows opt-out.

---

#### P0.2 — Disable Refresh for Per-Row "Force Crawl"

- [ ] **P0.2.1** Open `app/dashboard/sites/[id]/pages/page.tsx`
- [ ] **P0.2.2** Locate the `<ActionForm action={triggerPageCrawlAction} ...>` component (around line 409)
- [ ] **P0.2.3** Add prop `refreshOnSuccess={false}` to that `ActionForm`
- [ ] **P0.2.4** Test: click "Force crawl" on a page row → toast appears, no page refresh, no scroll reset

**Acceptance:** "Force crawl" shows toast without route refresh.

---

#### P0.3 — Replace URL-Based Toast Banners with Centralized Flash Handler

##### P0.3.1 — Create Flash Toasts Component

- [ ] **P0.3.1.1** Create file `components/dashboard/flash-toasts.tsx`
- [ ] **P0.3.1.2** Add `"use client"` directive
- [ ] **P0.3.1.3** Import `useSearchParams`, `usePathname`, `useRouter` from `next/navigation`
- [ ] **P0.3.1.4** Import `toast` from `sonner`
- [ ] **P0.3.1.5** Implement `useEffect` that:
  - Reads `toast`, `error`, `details` from search params
  - Decodes values with `decodeURIComponent`
  - Calls `toast.success(toastMessage)` if `toast` param exists
  - Calls `toast.error(errorMessage, { description: details })` if `error` param exists
  - Calls `router.replace(pathname)` to clean URL (remove those params)
- [ ] **P0.3.1.6** Export `FlashToasts` component

##### P0.3.2 — Mount Flash Toasts in Dashboard Layout

- [ ] **P0.3.2.1** Open `app/dashboard/layout.tsx`
- [ ] **P0.3.2.2** Import `FlashToasts` from `@/components/dashboard/flash-toasts`
- [ ] **P0.3.2.3** Add `<FlashToasts />` inside the layout (near where `<Toaster />` is mounted)

##### P0.3.3 — Delete Per-Page Banner Blocks

- [ ] **P0.3.3.1** Open `app/dashboard/sites/[id]/page.tsx`
  - [ ] Delete the `{actionErrorMessage ? ... : toastMessage ? ... : null}` JSX block
  - [ ] Delete `toastMessage`, `actionErrorMessage`, `actionErrorDetails` variable declarations
  - [ ] Delete `decodeSearchParam` function if unused
  - [ ] Update `SitePageProps.searchParams` type to remove `toast`/`error`/`details` if unused

- [ ] **P0.3.3.2** Open `app/dashboard/sites/[id]/admin/page.tsx`
  - [ ] Delete the `{actionErrorMessage ? ... : toastMessage ? ... : null}` JSX block
  - [ ] Delete `toastMessage`, `actionErrorMessage` variable declarations
  - [ ] Delete `decodeSearchParam` function if unused

- [ ] **P0.3.3.3** Open `app/dashboard/sites/[id]/pages/page.tsx`
  - [ ] Delete the `{actionErrorMessage ? ... : toastMessage ? ... : null}` JSX block
  - [ ] Delete `toastMessage`, `actionErrorMessage`, `returnTo` variable declarations
  - [ ] Delete `decodeSearchParam` function if unused

- [ ] **P0.3.3.4** Open `app/dashboard/sites/[id]/overrides/page.tsx`
  - [ ] Delete the `{actionErrorMessage ? ... : toastMessage ? ... : null}` JSX block
  - [ ] Delete `toastMessage`, `actionErrorMessage`, `returnTo` variable declarations
  - [ ] Delete `decodeSearchParam` function if unused

- [ ] **P0.3.3.5** Run `pnpm check` to verify no broken imports or type errors

**Acceptance:** No "Dismiss" links exist. Toasts auto-dismiss. URLs clean themselves.

---

### Milestone P1: Add Pagination to Pages List

**Goal:** Reduce payload size and render time for sites with many pages.

#### P1.1 — Backend: Add Pagination Params to Webhooks API

- [ ] **P1.1.1** Open the webhooks worker handler for `GET /sites/{siteId}/pages`
- [ ] **P1.1.2** Parse query params: `limit` (default 50, clamp [1, 200]), `offset` (default 0)
- [ ] **P1.1.3** Apply Supabase `.range(offset, offset + limit - 1)` to query
- [ ] **P1.1.4** Add secondary sort on `id.desc` for stability
- [ ] **P1.1.5** Verify response shape remains exactly `{ "pages": [...] }` (no extra keys)
- [ ] **P1.1.6** Deploy updated webhooks worker

**Acceptance:** API accepts `?limit=50&offset=0` and returns bounded results.

---

#### P1.2 — Dashboard Wrapper: Extend `fetchSitePages` Signature

- [ ] **P1.2.1** Open `internal/dashboard/webhooks.ts`
- [ ] **P1.2.2** Change `fetchSitePages` signature to accept `options?: { limit?: number; offset?: number }`
- [ ] **P1.2.3** Build querystring from options
- [ ] **P1.2.4** Update path to include querystring if options provided
- [ ] **P1.2.5** Verify function returns `data.pages` (not the whole response object)
- [ ] **P1.2.6** Run `pnpm check` to ensure no type errors

**Acceptance:** Wrapper accepts pagination options and returns `SitePageSummary[]`.

---

#### P1.3 — UI: Implement Page-Based Pagination

- [ ] **P1.3.1** Open `app/dashboard/sites/[id]/pages/page.tsx`
- [ ] **P1.3.2** Parse `page` from search params (1-indexed, default 1)
- [ ] **P1.3.3** Calculate `pageSize = 50`, `offset = (pageNumber - 1) * pageSize`
- [ ] **P1.3.4** Calculate `requestedLimit = pageSize + 1` (for hasNext detection)
- [ ] **P1.3.5** Update `fetchSitePages` call to pass `{ limit: requestedLimit, offset }`
- [ ] **P1.3.6** Compute `hasNextPage = results.length > pageSize`
- [ ] **P1.3.7** Compute `visiblePages = hasNextPage ? results.slice(0, pageSize) : results`
- [ ] **P1.3.8** Render table using `visiblePages`
- [ ] **P1.3.9** Add pagination controls at table footer:
  - [ ] "Previous" link if `pageNumber > 1` → `?page={pageNumber - 1}`
  - [ ] "Next" link if `hasNextPage` → `?page={pageNumber + 1}`
- [ ] **P1.3.10** Test with a site that has > 50 pages

**Acceptance:** Initial load shows max 50 rows. Pagination works. No full refresh on page change.

---

### Milestone P2: Long-Running Job Progress Updates

**Goal:** Show live crawl/translate progress without manual refresh.

#### P2.1 — Create Status Proxy API Route

- [ ] **P2.1.1** Create file `app/api/dashboard/sites/[siteId]/status/route.ts`
- [ ] **P2.1.2** Implement `GET` handler that:
  - [ ] Calls `requireDashboardAuth()`
  - [ ] Fetches site data from webhooks API
  - [ ] Returns JSON with: `{ crawlRun: {...} | null, translationRuns: [...] | null }`
- [ ] **P2.1.3** Add error handling and appropriate HTTP status codes

**Acceptance:** `GET /api/dashboard/sites/{siteId}/status` returns current job statuses.

---

#### P2.2 — Create Client Polling Hook

- [ ] **P2.2.1** Create file `internal/dashboard/use-poll.ts`
- [ ] **P2.2.2** Implement `usePoll` hook with signature:
  ```ts
  usePoll<T>({ url: string; enabled: boolean; intervalMs?: number }): { data: T | null; isPolling: boolean; error: Error | null }
  ```
- [ ] **P2.2.3** Poll every 3000ms when enabled
- [ ] **P2.2.4** Stop polling on error or when disabled
- [ ] **P2.2.5** Cleanup interval on unmount

**Acceptance:** Hook polls endpoint and returns updated data.

---

#### P2.3 — Convert Status Cards to Client Components

- [ ] **P2.3.1** Create `components/dashboard/crawl-status-card.tsx` (client component)
- [ ] **P2.3.2** Accept initial data as props, poll for updates
- [ ] **P2.3.3** Render status badge, progress (completed/total), timestamps
- [ ] **P2.3.4** Stop polling on terminal states (`completed`, `failed`, `cancelled`)
- [ ] **P2.3.5** Update relevant pages to use the new client component
- [ ] **P2.3.6** Add `refreshOnSuccess={false}` to `triggerCrawlAction` and `translateAndServeAction` forms

**Acceptance:** Status updates appear live without page refresh.

---

### Milestone P3: Cache Invalidation Correctness

**Goal:** Ensure sidebar/nav reflects current state without waiting for TTL.

#### P3.1 — Audit and Fix Cache Invalidation Calls

- [ ] **P3.1.1** Open `app/dashboard/actions.ts`
- [ ] **P3.1.2** Verify `invalidateSitesCache(auth.webhooksAuth)` is called in:
  - [ ] `createSiteAction`
  - [ ] `deleteSiteAction`
  - [ ] `activateSiteAction`
  - [ ] `deactivateSiteAction`
  - [ ] `updateSiteStatusAction`
  - [ ] `verifyDomainAction`
  - [ ] `provisionDomainAction`
  - [ ] `refreshDomainAction`
  - [ ] `setLocaleServingAction`
- [ ] **P3.1.3** Add missing `invalidateSitesCache` calls where needed
- [ ] **P3.1.4** Remove overly broad `revalidatePath("/dashboard")` calls where refresh is disabled

**Acceptance:** Sidebar updates immediately after mutations without waiting for Redis TTL.

---

### Milestone P4: Maintainability Refactors

**Goal:** Reduce code duplication and improve maintainability.

#### P4.1 — Extract Duplicated Utilities

- [ ] **P4.1.1** Create file `internal/dashboard/format.ts`
- [ ] **P4.1.2** Move `formatTimestamp` function to this file
- [ ] **P4.1.3** Move `formatNextCrawlAt` function to this file
- [ ] **P4.1.4** Export both functions
- [ ] **P4.1.5** Create file `internal/dashboard/status.ts`
- [ ] **P4.1.6** Move `resolveServingStatusVariant` function to this file
- [ ] **P4.1.7** Move `resolveDomainStatusVariant` function to this file
- [ ] **P4.1.8** Move `resolveCrawlStatusVariant` function to this file
- [ ] **P4.1.9** Export all functions
- [ ] **P4.1.10** Update imports in all pages that used inline versions
- [ ] **P4.1.11** Delete inline function definitions from pages
- [ ] **P4.1.12** Run `pnpm check` to verify no broken imports

**Acceptance:** No duplicate utility functions across pages.

---

#### P4.2 — Fix Glossary Editor Input Lag

- [ ] **P4.2.1** Open `app/dashboard/sites/[id]/glossary-editor.tsx`
- [ ] **P4.2.2** Locate the `useMemo` that calls `JSON.stringify(entries)`
- [ ] **P4.2.3** Move serialization to `onSubmit` handler instead of per-render
- [ ] **P4.2.4** Update hidden input to be populated in form submit handler
- [ ] **P4.2.5** Test with 100+ glossary entries to verify no lag

**Acceptance:** Typing in glossary fields has no perceptible delay.

---

#### P4.3 — Reduce Duplicate Data Fetching in Layout

- [ ] **P4.3.1** Open `app/dashboard/layout.tsx`
- [ ] **P4.3.2** Fetch sites once at layout level
- [ ] **P4.3.3** Pass `sites` as prop to `SitesNavSection` (remove internal fetch)
- [ ] **P4.3.4** Pass `sites` as prop to `SitesUsageSummary` (remove internal fetch)
- [ ] **P4.3.5** Verify pages don't re-fetch sites when layout already has them

**Acceptance:** `listSitesCached` called once per render, not multiple times.

---

#### P4.4 — Add Route-Level Loading States

- [ ] **P4.4.1** Create `app/dashboard/sites/[id]/loading.tsx` with skeleton UI
- [ ] **P4.4.2** Create `app/dashboard/sites/[id]/pages/loading.tsx` with skeleton table
- [ ] **P4.4.3** Create `app/dashboard/sites/[id]/admin/loading.tsx` with skeleton form
- [ ] **P4.4.4** Verify loading states appear during navigation

**Acceptance:** Users see skeleton UI immediately during navigation.

---

### Implementation Order Summary

| Order | Milestone | Risk   | Impact |
| ----- | --------- | ------ | ------ |
| 1     | P0.1      | Low    | High   |
| 2     | P0.2      | Low    | Medium |
| 3     | P0.3      | Medium | High   |
| 4     | P1.1      | Medium | High   |
| 5     | P1.2      | Low    | High   |
| 6     | P1.3      | Medium | High   |
| 7     | P2.1      | Medium | Medium |
| 8     | P2.2      | Low    | Medium |
| 9     | P2.3      | Medium | Medium |
| 10    | P3.1      | Low    | Medium |
| 11    | P4.1      | Low    | Low    |
| 12    | P4.2      | Low    | Low    |
| 13    | P4.3      | Medium | Low    |
| 14    | P4.4      | Low    | Low    |

---

## Conclusion

The dashboard is architecturally functional but has accumulated technical debt that manifests as poor perceived performance. The root cause is the reliance on full-page refreshes for state synchronization.

**The single highest-impact change would be replacing `router.refresh()` with optimistic updates and targeted mutations.** This alone would eliminate the "jankiness" users experience after every action.

Secondary priorities focus on code organization (splitting large files) and eliminating duplication. These improve maintainability but have less user-visible impact.

The recommended approach is incremental: fix the worst UX issue first (page reloads), then systematically address structural issues without a large rewrite.
