# Code Review: WebLingo User Dashboard (Final Implementation Spec)

Date: 2026-01-08
Reviewer: gemini-3-flash-preview

## 0. Executive Summary & Source of Truth

This report has been consolidated following a multi-analyst review of the WebLingo dashboard. The following implementation plan is "Codex-ready"—designed for direct execution with minimal interpretation.

**Core Environment (Verified):**

- **Next.js**: 16.1.1 (Source: `package.json`)
- **React**: 19.2.3
- **Dependencies**: `sonner` for toasts. **NO SWR or React Query** is present.
- **Authentication**: Server-side Webhooks Auth via Supabase.

---

## 1. High-Confidence Problems

1.  **Implicit Global Refresh**: Every successful `ActionForm` triggers `router.refresh()`, causing unnecessary server-side re-computation and hydration for the entire page tree.
2.  **Hydration Overload**: Large tables (Pages, Domains) render a full `ActionForm` client component per row, leading to high hydration costs.
3.  **No Pagination**: `fetchSitePages` and the UI render the entire page list at once, creating a scalability wall.
4.  **URL-Polluted Feedback**: Success/error messages are encoded in URL search params, requiring full navigations to "Dismiss".
5.  **Data Fetching Duplication**: `listSitesCached` is called redundantly in layout and components.
6.  **Blind Cache Invalidation**: `invalidateSitesCache` is missed in several mutation actions, leading to stale sidebars.
7.  **Input Lag**: The Glossary editor stringifies the entire entries array on every change.
8.  **Status Blindness**: Long-running crawl/translation jobs have no live progress indicators.

---

## 2. Verified Source Artifacts

### 2.1 `ActionForm` (Implicit Refresh Issue)

Current implementation in `components/dashboard/action-form.tsx` forces a `router.refresh()` on every success without a redirect.

```tsx
// components/dashboard/action-form.tsx (simplified)
useEffect(() => {
  if (wasPending.current && !pending && state.ok) {
    const redirectTo = typeof state.meta?.redirectTo === "string" ? state.meta.redirectTo : null;
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh(); // <--- This causes the full-page jank
    }
    onSuccess?.(state);
  }
  wasPending.current = pending;
}, [pending, state, router, onSuccess]);
```

### 2.2 `ActionResponse` Type

Consistent across the codebase for all Server Actions in `app/dashboard/actions.ts`:

```ts
export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};
```

---

## 3. Implementation Roadmap

### Milestone 0: P0 — UI/UX Stabilization (No-Jank Foundations)

_Goal: Stop unnecessary full-page refreshes and clean up URL-based feedback._

- [ ] **Task 0.1**: Refactor `ActionFormProps` in `components/dashboard/action-form.tsx` to include `refreshOnSuccess?: boolean`.
- [ ] **Task 0.2**: Update `ActionForm` `useEffect` body to implement conditional refresh:
  - If `state.meta.redirectTo` is present, `router.push()` and skip refresh.
  - Else, use `refreshOnSuccess` (prop) ?? `state.meta.refresh` (from action) ?? `true` (default).
- [ ] **Task 0.3**: Update "Force crawl" row action in `app/dashboard/sites/[id]/pages/page.tsx` with `refreshOnSuccess={false}`.
- [ ] **Task 0.4**: Create `components/dashboard/flash-toasts.tsx` client component that:
  - Reads `toast`, `error`, and `details` from `useSearchParams`.
  - Shows a `sonner` toast if present.
  - Calls `router.replace(pathname)` immediately after showing the toast to clean the URL.
- [ ] **Task 0.5**: Mount `<FlashToasts />` once in `app/dashboard/layout.tsx`.
- [ ] **Task 0.6**: Delete existing search-param banner blocks and the `decodeSearchParam` helper from all dashboard page files (e.g., `sites/[id]/page.tsx`, `sites/[id]/pages/page.tsx`).

### Milestone 1: P1 — Pagination & Scalability

_Goal: Implement server-side pagination to handle large page lists._

- [ ] **Task 1.1**: Update `fetchSitePages` in `internal/dashboard/webhooks.ts` to accept `limit` and `offset` and return `data.pages`:
  ```ts
  export async function fetchSitePages(
    auth: AuthInput,
    siteId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<SitePageSummary[]> {
    const qs = new URLSearchParams();
    if (options?.limit) qs.set("limit", String(options.limit));
    if (options?.offset) qs.set("offset", String(options.offset));
    const data = await request({
      path: `/sites/${siteId}/pages${qs.size ? `?${qs.toString()}` : ""}`,
      auth,
      schema: listSitePagesResponseSchema,
    });
    return data.pages;
  }
  ```
- [ ] **Task 1.2**: Implement pagination logic in `app/dashboard/sites/[id]/pages/page.tsx`:
  - Parse `page` search param (default 1).
  - Request `limit: 51` (pageSize + 1) to detect `hasNextPage`.
  - Slice the results to `pageSize: 50` for rendering.
- [ ] **Task 1.3**: Add footer pagination controls (Previous/Next) to the Pages view.

### Milestone 2: P2 — Real-time Monitoring

_Goal: Provide live progress for Crawl and Translate runs via polling._

- [ ] **Task 2.1**: Create `app/api/dashboard/sites/[siteId]/status/route.ts` as a proxy endpoint for job status (requires `requireDashboardAuth`).
- [ ] **Task 2.2**: Implement `internal/dashboard/use-poll.ts` client hook using `setInterval` (3s).
- [ ] **Task 2.3**: Convert Crawl/Translate summary cards into client components and wire up the `usePoll` hook for live badge/progress updates.

### Milestone 3: P3 & P4 — Data Integrity & Refactoring

_Goal: Fix cache invalidation, performance bottlenecks, and code organization._

- [ ] **Task 3.1**: Audit all actions in `app/dashboard/actions.ts` and ensure `await invalidateSitesCache(auth.webhooksAuth)` is called for any mutation affecting the sidebar (site status, domains, locales).
- [ ] **Task 3.2**: Fix Glossary editor input lag in `app/dashboard/sites/[id]/glossary-editor.tsx` by serializing the entries only on form submission instead of per keystroke.
- [ ] **Task 3.3**: Consolidate `listSitesCached` in `app/dashboard/layout.tsx` and pass the data down to `SitesNavSection` and `SitesUsageSummary` as props.
- [ ] **Task 3.4**: Extract formatting and status badge utilities to new files: `@internal/dashboard/format.ts` and `@internal/dashboard/status.ts`.
- [ ] **Task 3.5**: Split `app/dashboard/actions.ts` into a modular directory structure (e.g., `actions/sites.ts`, `actions/domains.ts`) with a root `index.ts`.
