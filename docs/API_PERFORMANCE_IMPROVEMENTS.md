# API Performance Improvements

This document outlines performance optimizations identified for the WebLingo website and serve-worker. Each suggestion includes context, justification, behavioral impact, testing strategy, and risk assessment.

---

## Table of Contents

1. [Lazy Environment Validation](#1-lazy-environment-validation)
2. [Edge Runtime for Preview Proxy Routes](#2-edge-runtime-for-preview-proxy-routes)
3. [Parallel Auth Bootstrap](#3-parallel-auth-bootstrap)
4. [Web Crypto API for Edge Compatibility](#4-web-crypto-api-for-edge-compatibility)
5. [Acknowledge First, Process Later (Webhooks)](#5-acknowledge-first-process-later-webhooks)
6. [Idempotency Check for Webhooks](#6-idempotency-check-for-webhooks)
7. [Use Supabase SDK for User Lookup](#7-use-supabase-sdk-for-user-lookup)
8. [Move Webhook Processing to Cloudflare Worker](#8-move-webhook-processing-to-cloudflare-worker)
9. [Parallel Manifest + Dictionary Fetch (serve-worker)](#9-parallel-manifest--dictionary-fetch-serve-worker)
10. [Routes Cache Warming (serve-worker)](#10-routes-cache-warming-serve-worker)

---

## 1. Lazy Environment Validation

### Context

The application uses Zod to validate environment variables. Currently, validation runs **synchronously at module load time** when any file imports `@internal/core`:

```typescript
// internal/core/env.ts (current)
const runtimeEnv = isServer
  ? fullEnvSchema.parse({ ...readClientEnv(), ...readServerEnv() })
  : clientEnvSchema.parse(readClientEnv());

export const env = runtimeEnv as FullEnv;
```

The schema includes complex `.superRefine()` logic that validates Redis credential pairs, adding 50-150ms to every cold start.

Additionally, `internal/core/redis.ts` has a side-effect import:

```typescript
void env; // Triggers validation even when Redis isn't used
```

### What It Provides

- Reduces cold start time by 50-150ms
- Validation still runs on first env property access (preserves fail-fast)

### Behavioral Change

**No.** Validation still occurs and still fails fast. The only difference is timing:

- Before: Fails at module import
- After: Fails at first env property access (same request, milliseconds later)

### Testing Strategy

1. All existing tests pass unchanged
2. Add test: verify env validation still throws on missing required variables
3. Measure cold start timing before/after

### Affected Endpoints

All routes that import `@internal/core` (most API routes)

### Risks

**Low.** The Proxy pattern is standard JavaScript. Validation errors now surface on first request instead of startup, but in serverless these are the same moment.

### Files to Modify

- `internal/core/env.ts` — Implement lazy Proxy pattern
- `internal/core/redis.ts` — Remove `void env;` side effect

---

## 2. Edge Runtime for Preview Proxy Routes

### Context

Three preview routes act as pure proxies to the Cloudflare webhooks-worker:

- `app/api/previews/route.ts`
- `app/api/previews/[id]/route.ts`
- `app/api/previews/[id]/stream/route.ts`

Note: these are Next.js proxy routes in the frontend repo, not webhooks-worker API endpoints.

They currently run on Node.js runtime (`export const runtime = "nodejs"`), which has cold starts of 100-500ms. However, these routes only use Edge-compatible APIs:

```typescript
// Only imports
import { NextRequest, NextResponse } from "next/server";

// Only uses
process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE  // Read-only env access
fetch(...)                                  // Native Web API
Response.body                               // Web Streams API
```

They do **not** import `@internal/core`, `@internal/dashboard/auth`, or any Node.js-specific code.

### What It Provides

- Near-zero cold starts (~5-50ms vs 100-500ms)
- Runs at edge locations closer to users
- No code changes required — only config change

### Behavioral Change

**No.** Same functionality, same responses.

### Testing Strategy

1. Existing tests pass unchanged
2. Manual test: `POST /api/previews` returns preview status
3. Verify SSE streaming works in Edge (`/api/previews/[id]/stream`)

### Affected Endpoints

- `POST /api/previews`
- `GET /api/previews/[id]`
- `GET /api/previews/[id]/stream`

### Risks

**Low.**

- Edge has 1MB request body limit (preview requests are small JSON)
- Edge has 30-second execution limit (proxies complete in <1s)
- Routes are isolated — no problematic dependencies

### Files to Modify

- `app/api/previews/route.ts` — Change `runtime` to `"edge"`
- `app/api/previews/[id]/route.ts` — Change `runtime` to `"edge"`
- `app/api/previews/[id]/stream/route.ts` — Change `runtime` to `"edge"`

---

## 3. Parallel Auth Bootstrap

### Context

When an agency user views the dashboard as a customer account, `getDashboardAuth()` fetches two bootstraps **sequentially**:

```typescript
// internal/dashboard/auth.ts (current)
const actorBootstrap = await getBootstrap({ ... });       // 100-300ms
// ... build allowedSubjectIds from actorBootstrap ...
const subjectBootstrap = await getBootstrap({ ... });     // 100-300ms
```

The subject bootstrap could start earlier since it only depends on the cookie value, not the actor result.

### What It Provides

- Saves 100-300ms when agency user is acting as a customer
- Both bootstraps fetched concurrently

### Behavioral Change

**No functional change.** Same data returned.

**Implementation detail:** A speculative fetch may occur for the subject bootstrap before we verify it's in the allowed list. If the subject is not allowed, the speculative result is discarded.

### Testing Strategy

1. All auth tests pass unchanged
2. Verify `actingAsCustomer` flag is set correctly when switching contexts
3. Measure latency before/after with agency account
4. Verify discarded speculative fetch doesn't cause errors

### Affected Endpoints

All `/dashboard/*` routes that call `requireDashboardAuth()`

### Risks

**Medium.**

- Speculative fetch wastes one network call if subject cookie is invalid
- Error handling must be robust (`.catch()` on speculative promise)
- Must ensure allowed-check still uses actor bootstrap's agency customers list

### Files to Modify

- `internal/dashboard/auth.ts` — Parallelize bootstrap calls

---

## 4. Web Crypto API for Edge Compatibility

### Context

Two files use `node:crypto` for SHA-256 hashing:

```typescript
// internal/dashboard/auth.ts
import { createHash } from "node:crypto";
const digest = createHash("sha256").update(input).digest("hex");

// internal/dashboard/data.ts
import { createHash } from "node:crypto";
return createHash("sha256").update(token).digest("hex");
```

This prevents dashboard routes from running on Edge Runtime. The Web Crypto API is available in Edge and provides the same functionality:

```typescript
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

### What It Provides

- Enables future migration of dashboard routes to Edge Runtime
- Removes Node.js dependency from auth/data modules

### Behavioral Change

**No.** The hash output is identical — both use SHA-256 and produce the same hex digest.

### Breaking Change for Existing Data?

**No.** The hashes are used for **Redis cache keys only**:

```typescript
// auth.ts — Bootstrap cache key
return `${BOOTSTRAP_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;

// data.ts — Sites cache key
return `${SITES_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${hashToken(token)}`;
```

The hash algorithm produces **identical output** for the same input. Since both `node:crypto` and Web Crypto use SHA-256:

- Same input → Same hash → Same cache key
- No orphaned data, no cache invalidation required

If the implementation were somehow different (it isn't), the worst case would be:

- Old cache entries become unreachable (key mismatch)
- New entries created on next request
- Old entries expire naturally based on TTL (5-10 minutes)
- **No persistent data is affected** — only ephemeral cache

### Testing Strategy

1. Unit test: Verify `sha256Hex("test")` produces expected output
2. Integration test: Verify cache hits still work after migration
3. Compare hash outputs between `node:crypto` and Web Crypto implementations

### Affected Endpoints

After this change, these routes could optionally move to Edge Runtime:

- `app/api/dashboard/sites/[siteId]/status/route.ts`
- Any future dashboard API routes

### Risks

**Low.**

- Web Crypto is async (`crypto.subtle.digest` returns Promise)
- Callers must be updated to `await` the result
- The hash algorithm is identical; output is deterministic

### Files to Modify

- `internal/dashboard/auth.ts` — Replace `createHash` with async `sha256Hex`
- `internal/dashboard/data.ts` — Replace `createHash` with async `sha256Hex`
- Add shared util: `lib/crypto.ts` or `internal/core/hash.ts`

---

## 5. Acknowledge First, Process Later (Webhooks)

### Context

The current webhook handler processes everything synchronously before responding:

```typescript
// app/api/stripe/webhook/route.ts (current flow)
export async function POST(request: NextRequest) {
  // 1. Verify signature (~5ms)
  // 2. Extract data (~1ms)
  // 3. Fetch user from Supabase (~100-200ms)
  // 4. Create/update user in Supabase (~100-200ms)
  // 5. Return response
}
// Total: 200-400ms before Stripe gets a response
```

Payment gateways expect fast acknowledgment (<20 seconds, ideally <5 seconds). Slow responses can trigger:

- Retry storms
- Webhook delivery being marked as failed
- Poor user experience waiting for subscription confirmation

### What It Provides

- Response returns in ~20-50ms instead of 200-400ms
- Processing happens in background
- Resilient to temporary Supabase slowdowns

### Behavioral Change

**Yes.** Processing becomes asynchronous:

- Before: User created before HTTP response
- After: User created after HTTP response (typically within 1-2 seconds)

### Testing Strategy

1. Unit test: Verify immediate response returned
2. Unit test: Verify background function is called with correct payload
3. Integration test: Send webhook, poll for user creation (may take 1-2s)
4. Verify retried webhooks are handled correctly (requires idempotency)

### Affected Endpoints

- `POST /api/stripe/webhook` (or any payment gateway webhook)

### Risks

**Medium.**

- If background processing fails, user isn't created but gateway thinks it succeeded
- **Must combine with idempotency** to handle retries correctly
- Need monitoring/alerting for failed background jobs
- Vercel `waitUntil` is "best effort" — work may be lost if function is killed

### Files to Modify

- `app/api/stripe/webhook/route.ts` — Restructure to use `waitUntil`

### Implementation Options

**Option A: Vercel `waitUntil`**

```typescript
import { waitUntil } from "@vercel/functions";

export async function POST(request: NextRequest) {
  const event = verifySignature(...);
  waitUntil(processWebhookEvent(event));
  return NextResponse.json({ received: true });
}
```

**Option B: Forward to Cloudflare Queue** (see suggestion #8)

---

## 6. Idempotency Check for Webhooks

### Context

Payment gateways (Stripe, Paddle, LemonSqueezy, etc.) retry webhooks when they don't receive a timely response or receive errors. Without idempotency, retries can cause:

- Duplicate user creation attempts
- Race conditions
- Inconsistent state

### What It Provides

- Prevents duplicate processing of webhook events
- Uses existing Redis (Upstash) infrastructure
- Gateway-agnostic — works with any payment provider

### Behavioral Change

**Yes.** Duplicate events are acknowledged (200 response) but not processed.

### Testing Strategy

1. Unit test: First call sets Redis key and processes; second call skips
2. Integration test: Send same event ID twice, verify user created once
3. Verify Redis failure falls back to processing (safe default)

### Affected Endpoints

- `POST /api/stripe/webhook` (or any payment gateway webhook)

### Risks

**Low.**

- Redis failure should fall back to processing (not skipping)
- Key must use event ID (not payload hash) to handle identical retries
- TTL must exceed gateway retry window (24 hours is safe)

### Files to Modify

- `app/api/stripe/webhook/route.ts` — Add idempotency check
- Optionally: `internal/core/idempotency.ts` — Shared util

### Implementation

```typescript
import { redis } from "@internal/core";

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const key = `webhook:event:${eventId}`;
    const result = await redis.set(key, "1", { nx: true, ex: IDEMPOTENCY_TTL });
    return result === null; // null = key already existed
  } catch {
    // Redis failure: fall back to processing (safe default)
    return false;
  }
}
```

---

## 7. Use Supabase SDK for User Lookup

### Context

`fetchUserByEmail` in `lib/supabase/admin.ts` uses raw `fetch()`:

```typescript
// Current implementation
const response = await fetch(url, {
  headers: {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  },
  cache: "no-store",
});
```

Meanwhile, `createServiceRoleClient()` creates a cached Supabase SDK client in the same file but isn't used for user lookups.

### What It Provides

- Consistent use of cached Supabase client
- Potential HTTP keep-alive / connection reuse
- Better error typing from SDK
- Single pattern for all Supabase admin operations

### Behavioral Change

**No.** Same user lookup, same result.

### Testing Strategy

1. Existing tests pass unchanged
2. Verify lookup works for existing users
3. Verify lookup returns null for non-existing users
4. Verify error handling for Supabase failures

### Affected Endpoints

- `POST /api/stripe/webhook` (uses `fetchUserByEmail`)

### Risks

**Low.**

- SDK API may differ slightly from raw fetch
- Need to verify exact method for listing/finding users by email

### Files to Modify

- `lib/supabase/admin.ts` — Refactor `fetchUserByEmail` to use SDK

### Implementation

```typescript
export async function fetchUserByEmail(email: string): Promise<User | null> {
  const supabase = createServiceRoleClient();

  // Option 1: List users with filter (if supported)
  const { data, error } = await supabase.auth.admin.listUsers({
    filter: { email },
    perPage: 1,
  });

  if (error) throw error;
  return data.users[0] ?? null;
}
```

---

## 8. Move Webhook Processing to Cloudflare Worker

### Context

The WebLingo infrastructure already includes:

- `webhooks-worker` at `api.weblingo.app` handling various API routes
- Cloudflare Queues for async processing
- KV for idempotency
- Supabase integration

Currently, payment webhooks hit the Vercel Next.js app, which then often calls the Cloudflare worker anyway. This creates:

- Extra network hop
- Vercel cold start overhead
- Split responsibility between platforms

### What It Provides

- Consolidates API surface in Cloudflare
- Native queue integration for async processing
- Built-in idempotency patterns via KV
- Sub-50ms response times globally
- Geographic distribution at edge

### Behavioral Change

**Yes.**

- Webhook URL changes from Vercel to Cloudflare
- Processing logic moves to CF worker
- Requires Stripe Dashboard configuration change

### Testing Strategy

1. Local: `wrangler dev` with test webhook payloads
2. Staging: Configure Stripe test mode webhook to CF endpoint
3. Verify signature verification works
4. Verify user creation in Supabase
5. Verify idempotency via KV
6. Load test for performance validation

### Affected Endpoints

- Current: `POST https://www.weblingo.app/api/stripe/webhook`
- New: `POST https://api.weblingo.app/webhooks/billing`

### Risks

**High** (architectural change, but well-justified):

- Requires new route in webhooks-worker
- Requires new queue consumer for billing events
- Requires Stripe webhook URL update
- Needs rollback plan (keep old endpoint temporarily)
- More components to deploy and monitor

### Files to Create/Modify

**New files:**

- `workers/webhooks-worker/src/handlers/billing.ts` — Webhook handler
- `workers/billing-worker/` — Queue consumer (optional, could be in same worker)

**Modify:**

- `workers/webhooks-worker/src/routes.ts` — Add billing route
- `workers/webhooks-worker/wrangler.toml` — Add queue binding

### Architecture

```
┌─────────────────┐     ┌────────────────────────────────────┐
│  Payment        │     │  Cloudflare                        │
│  Gateway        │────▶│  webhooks-worker                   │
│  (Stripe, etc)  │     │  api.weblingo.app/webhooks/billing │
└─────────────────┘     └───────────────┬────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────────┐
                        │  weblingo-billing queue           │
                        └───────────────┬───────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────────┐
                        │  billing-worker (consumer)        │
                        │  - Create/update Supabase user    │
                        │  - Sync subscription status       │
                        └───────────────────────────────────┘
```

---

## 9. Parallel Manifest + Dictionary Fetch (serve-worker)

### Context

In `serveProxiedResponse()`, manifest and dictionary are fetched sequentially:

```typescript
// workers/serve-worker/src/handler.ts (current)
const manifestInfo = pointer
  ? await loadManifestForDeployment(...)
  : null;
const dictionary = pointer
  ? await loadDictionary(...)
  : null;
```

Both are independent R2 reads that can run in parallel.

### What It Provides

- Saves 20-100ms when both caches are cold
- Simple `Promise.all()` change

### Behavioral Change

**No.** Same data, same responses.

### Testing Strategy

1. Existing serve-worker tests pass unchanged
2. Measure latency in cache-miss scenario before/after
3. Verify both error handlers still called independently

### Affected Endpoints

All translated page requests handled by serve-worker

### Risks

**Very low.**

- R2 reads are independent — no ordering constraint
- Error handling preserved via separate `onError` callbacks

### Files to Modify

- `workers/serve-worker/src/handler.ts` — Use `Promise.all()`

### Implementation

```typescript
const [manifestInfo, dictionary] = pointer
  ? await Promise.all([
      loadManifestForDeployment(env, route.site.siteId, route.locale.lang, pointer, {
        onError: onManifestError,
      }),
      loadDictionary(env, route.site.siteId, route.locale.lang, pointer, {
        onError: onDictionaryError,
      }),
    ])
  : [null, null];
```

---

## 10. Routes Cache Warming (serve-worker)

### Context

Routes are cached with a 5-minute TTL (`CACHE_ROUTES_TTL_SECONDS = 300`). After expiry, the first request pays the full KV → R2 fallback cost, adding latency for that unlucky user.

### What It Provides

- Pre-warms routes cache before TTL expires
- Eliminates cache-miss latency for first request after TTL
- Uses existing scheduled handler pattern

### Behavioral Change

**No.** Routes are the same, just pre-loaded.

### Testing Strategy

1. Verify cron job runs every 4 minutes
2. Verify routes are cached after cron execution
3. Compare first-request latency with/without warming

### Affected Endpoints

All translated page requests handled by serve-worker

### Risks

**Very low.**

- One extra KV/R2 read every 4 minutes (negligible cost)
- Cron failure has no impact — regular fallback still works
- Existing cron infrastructure in webhooks-worker can be referenced

### Files to Modify

- `workers/serve-worker/src/index.ts` — Add scheduled handler
- `workers/serve-worker/wrangler.toml` — Add cron trigger

### Implementation

```typescript
// index.ts
export default {
  async fetch(...) { ... },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Pre-warm routes cache
    ctx.waitUntil(resolveRoutes(env).catch((error) => {
      console.error("[serve-worker] routes cache warming failed:", error);
    }));
  },
};
```

```toml
# wrangler.toml
[triggers]
crons = ["*/4 * * * *"]  # Every 4 minutes (before 5-min TTL)
```

---

## Summary

| #   | Suggestion                       | Behavior Change | Risk     | Expected Gain                 |
| --- | -------------------------------- | --------------- | -------- | ----------------------------- |
| 1   | Lazy env validation              | No              | Low      | 50-150ms cold start           |
| 2   | Edge Runtime for previews        | No              | Low      | 100-500ms cold start          |
| 3   | Parallel auth bootstrap          | No              | Medium   | 100-300ms dashboard           |
| 4   | Web Crypto API                   | No              | Low      | Enables Edge for dashboard    |
| 5   | Acknowledge first, process later | Yes             | Medium   | 150-350ms webhook response    |
| 6   | Idempotency check                | Yes (dedup)     | Low      | Prevents duplicate processing |
| 7   | Supabase SDK for user lookup     | No              | Low      | Consistency, minor perf       |
| 8   | Move webhooks to CF Worker       | Yes             | High     | Architectural consolidation   |
| 9   | Parallel manifest+dict           | No              | Very Low | 20-100ms serve-worker         |
| 10  | Routes cache warming             | No              | Very Low | Eliminates TTL gaps           |

---

## Part 2: Webhooks Worker Analysis

The `workers/webhooks-worker` handles 47 API routes. Analysis reveals several optimization opportunities that follow DRY, KISS, and SOLID principles.

### Current Architecture Strengths

The worker already implements several good patterns:

1. **Bootstrap caching** — Dashboard bootstrap responses are cached in KV with TTL
2. **Inflight deduplication** — Uses `Map<key, Promise>` to prevent duplicate bootstrap fetches
3. **Rate limiting** — Per-account rate limiting via KV
4. **Metrics wrapping** — DB and KV calls can be wrapped for observability

### 11. Eliminate Duplicate Auth Parsing (DRY Violation)

**Context**

The JWT is parsed twice per request for authenticated routes:

```typescript
// rate-limit.ts line 59
const auth = await authenticateRequest(request, env.WEBHOOK_SECRET);
return `acct:${auth.subjectAccountId}`;

// index.ts line 267 (called after maybeRateLimit returns)
const auth = await authenticateRequest(request, env.WEBHOOK_SECRET);
```

JWT verification uses `crypto.subtle.verify` which is fast (~0.1ms) but this is still wasteful.

**What it provides:**

- Eliminates redundant JWT parsing
- Cleaner code separation

**Behavioral change:** No

**Proposed fix:**

Pass the parsed auth context from rate limiter to handler:

```typescript
// rate-limit.ts
export async function maybeRateLimit(
  request: Request,
  env: RateLimitEnv,
): Promise<{ response: Response | null; auth: AuthContext | null }> {
  // ... existing logic ...
  const auth = await authenticateRequest(request, env.WEBHOOK_SECRET);
  return { response: null, auth };
}

// index.ts
const { response: rateLimited, auth: cachedAuth } = await maybeRateLimit(request, env);
if (rateLimited) return rateLimited;

// Reuse cachedAuth instead of re-parsing
const auth = cachedAuth ?? (await authenticateRequest(request, env.WEBHOOK_SECRET));
```

**Testing:** All existing tests pass unchanged.

**Affected endpoints:** All authenticated routes (~40 of 47)

**Risks:** Low. Simple refactor with clear typing.

**Files to modify:**

- `workers/webhooks-worker/src/rate-limit.ts`
- `workers/webhooks-worker/src/index.ts`

---

### 12. Eliminate Duplicate Account Lookups (DRY Violation)

**Context**

The account is fetched twice in many flows:

```typescript
// index.ts line 278
await ensureAccountActive(repos.accounts, accountId);

// Then inside handler (e.g., triggerCrawl line 722)
const { subjectFlags } = await resolveAccountContext(auth, repos);
// resolveAccountContext calls ensureAccountActive again internally
```

The `ensureAccountActive` function calls `accounts.findById()`, resulting in duplicate Supabase requests.

**What it provides:**

- Eliminates 1 DB round-trip per request (~20-50ms)
- Cleaner data flow

**Behavioral change:** No

**Proposed fix:**

Option A: Cache account in request context:

```typescript
// index.ts - sites.* routes
const account = await ensureAccountActive(repos.accounts, accountId);

// Pass account to handlers instead of repos alone
return createSite(body, auth, repos, envWithMetrics, event, { account });
```

Option B: Make `resolveAccountContext` accept pre-fetched account:

```typescript
export async function resolveAccountContext(
  auth: AuthContext,
  repos: RepositoryBundle,
  options?: { subjectAccount?: AccountRecord },
): Promise<...> {
  const subjectAccount = options?.subjectAccount
    ?? await ensureAccountActive(repos.accounts, auth.subjectAccountId);
  // ...
}
```

**Testing:**

- All existing tests pass unchanged
- Verify account is fetched exactly once per request

**Affected endpoints:** All `sites.*` routes (19 handlers that call `resolveAccountContext`)

**Risks:** Low. The account data is immutable within a request.

**Files to modify:**

- `workers/webhooks-worker/src/repositories.ts`
- `workers/webhooks-worker/src/index.ts`
- `workers/webhooks-worker/src/handlers/sites.ts`

---

### 13. Parallelize resolveAccountContext When Acting as Agency

**Context**

When an agency acts on behalf of a customer, three sequential DB calls occur:

```typescript
// repositories.ts lines 102-119
const subjectAccount = await ensureAccountActive(repos.accounts, auth.subjectAccountId);
// ...
const actorAccount = await ensureAccountActive(repos.accounts, auth.actorAccountId);
// ...
const agencyLink = await repos.agencyCustomers.find(auth.actorAccountId, auth.subjectAccountId);
```

These are independent and can run in parallel.

**What it provides:**

- Saves ~40-100ms for agency-context requests

**Behavioral change:** No

**Proposed fix:**

```typescript
export async function resolveAccountContext(
  auth: AuthContext,
  repos: RepositoryBundle,
): Promise<...> {
  if (auth.actorAccountId === auth.subjectAccountId) {
    // Same account - single lookup
    const subjectAccount = await ensureAccountActive(repos.accounts, auth.subjectAccountId);
    const subjectFlags = resolveFeatureFlags(subjectAccount.planType, subjectAccount.featureFlags);
    return { subjectAccount, actorAccount: subjectAccount, agencyLink: null, subjectFlags, actorFlags: subjectFlags };
  }

  // Different accounts - parallel lookup
  const [subjectAccount, actorAccount, agencyLink] = await Promise.all([
    ensureAccountActive(repos.accounts, auth.subjectAccountId),
    ensureAccountActive(repos.accounts, auth.actorAccountId),
    repos.agencyCustomers.find(auth.actorAccountId, auth.subjectAccountId),
  ]);

  // ... validation and flag resolution ...
}
```

**Testing:**

- All existing tests pass unchanged
- Add timing test for agency context

**Affected endpoints:** All routes when agency is acting as customer

**Risks:** Low. Validation logic unchanged, just execution order.

**Files to modify:**

- `workers/webhooks-worker/src/repositories.ts`

---

### 14. Extract Site Authorization to Middleware (DRY Violation)

**Context**

18 handlers repeat this exact pattern:

```typescript
const site = await repos.sites.findByIdForAccount(siteId, accountId);
if (!site) {
  throw new HttpError(404, "Site not found");
}
```

This violates DRY and spreads authorization logic across handlers.

**What it provides:**

- Single point of site authorization
- Cleaner handlers
- Easier to add caching later

**Behavioral change:** No

**Proposed fix:**

Create a middleware function in index.ts:

```typescript
async function requireSiteAccess(
  siteId: SiteId,
  accountId: AccountId,
  repos: RepositoryBundle,
): Promise<SiteRecord> {
  const site = await repos.sites.findByIdForAccount(siteId, accountId);
  if (!site) {
    throw new HttpError(404, "Site not found");
  }
  return site;
}

// In route handling:
case "sites.update": {
  if (!siteId) throw new HttpError(404, "Site not found");
  const site = await requireSiteAccess(siteId, accountId, repos);
  const body = await readJson(request);
  return updateSite(site, body, auth, repos, envWithMetrics, event);
}
```

**Benefits:**

- Handlers receive `site: SiteRecord` instead of doing their own lookup
- Authorization is centralized
- Future: Could add request-level caching

**Testing:**

- All existing tests pass unchanged
- Verify 404 behavior unchanged

**Affected endpoints:** 18 `sites.*` handlers

**Risks:** Low. This is a pure refactor following SOLID (Single Responsibility).

**Files to modify:**

- `workers/webhooks-worker/src/index.ts`
- `workers/webhooks-worker/src/handlers/sites.ts` (change signatures to accept `site`)

---

### 15. Parallel Fetches in getSite Handler

**Context**

The `getSite` handler makes sequential calls:

```typescript
// sites.ts lines 284-294
const details = await repos.sites.findByIdForAccountWithDetails(siteId, auth.subjectAccountId);
if (!details) throw new HttpError(404, "Site not found");

const latestCrawlRun = await repos.crawlRuns.findLatestBySite(details.site.id); // Sequential
const latestCrawlCaptureMode = latestCrawlRun
  ? await repos.pages.findLatestCrawlCaptureModeByRun(latestCrawlRun.id) // Depends on above
  : null;
```

The last call depends on `latestCrawlRun`, but it could be speculative.

**What it provides:**

- Saves ~20-40ms when crawl run exists

**Behavioral change:** No

**Proposed fix (speculative parallel):**

```typescript
const details = await repos.sites.findByIdForAccountWithDetails(siteId, auth.subjectAccountId);
if (!details) throw new HttpError(404, "Site not found");

// Start both in parallel
const [latestCrawlRun, crawlCaptureModePromise] = await Promise.all([
  repos.crawlRuns.findLatestBySite(details.site.id),
  repos.crawlRuns
    .findLatestBySite(details.site.id)
    .then((run) => (run ? repos.pages.findLatestCrawlCaptureModeByRun(run.id) : null)),
]);

// Actually we can't parallelize as written because second depends on first.
// Alternative: Use a single repository method that joins crawl_runs + pages
```

**Better approach:** Create a single repository method:

```typescript
// In CrawlRunsRepository
async findLatestBySiteWithCaptureMode(siteId: SiteId): Promise<{
  crawlRun: CrawlRunRecord;
  captureMode: CaptureMode | null;
} | null>
```

This reduces 2 HTTP calls to 1 with a SQL join.

**Testing:**

- Verify identical data returned
- Add timing test

**Affected endpoints:** `GET /sites/:siteId`

**Risks:** Low. Requires new repository method but cleaner API.

**Files to modify:**

- `packages/db/src/crawl-runs.ts`
- `workers/webhooks-worker/src/handlers/sites.ts`

---

### 16. Parallel Fetches in listSites Handler

**Context**

The `listSites` handler already uses `Promise.all` for per-site data:

```typescript
// sites.ts lines 257-263
const responses = await Promise.all(
  sites.map(async (site) => {
    const [locales, config, domains] = await Promise.all([
      repos.siteLocales.listBySite(site.id),
      repos.siteConfigs.findBySiteId(site.id),
      repos.siteDomains.listBySite(site.id),
    ]);
    // ...
  }),
);
```

This is good! However, if an account has many sites (e.g., 20), this creates 60 parallel DB requests which could cause connection issues.

**What it provides:**

- Controlled concurrency
- Prevents connection exhaustion

**Behavioral change:** No

**Proposed fix:**

Add concurrency limit:

```typescript
import pLimit from "p-limit";

const limit = pLimit(5); // Max 5 sites processed in parallel

const responses = await Promise.all(
  sites.map((site) =>
    limit(async () => {
      const [locales, config, domains] = await Promise.all([
        repos.siteLocales.listBySite(site.id),
        repos.siteConfigs.findBySiteId(site.id),
        repos.siteDomains.listBySite(site.id),
      ]);
      return formatSite(site, locales, config, domains, env);
    }),
  ),
);
```

**Alternative (no new dependency):** Use batched processing:

```typescript
const BATCH_SIZE = 5;
const responses = [];
for (let i = 0; i < sites.length; i += BATCH_SIZE) {
  const batch = sites.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(batch.map(/* ... */));
  responses.push(...batchResults);
}
```

**Testing:**

- Verify all sites returned
- Test with account having 20+ sites

**Affected endpoints:** `GET /sites`

**Risks:** Low. Adds safety for large accounts without changing behavior.

**Files to modify:**

- `workers/webhooks-worker/src/handlers/sites.ts`

---

## Summary

| #   | Suggestion                            | Behavior Change | Risk     | Expected Gain                 |
| --- | ------------------------------------- | --------------- | -------- | ----------------------------- |
| 1   | Lazy env validation                   | No              | Low      | 50-150ms cold start           |
| 2   | Edge Runtime for previews             | No              | Low      | 100-500ms cold start          |
| 3   | Parallel auth bootstrap               | No              | Medium   | 100-300ms dashboard           |
| 4   | Web Crypto API                        | No              | Low      | Enables Edge for dashboard    |
| 5   | Acknowledge first, process later      | Yes             | Medium   | 150-350ms webhook response    |
| 6   | Idempotency check                     | Yes (dedup)     | Low      | Prevents duplicate processing |
| 7   | Supabase SDK for user lookup          | No              | Low      | Consistency, minor perf       |
| 8   | Move webhooks to CF Worker            | Yes             | High     | Architectural consolidation   |
| 9   | Parallel manifest+dict                | No              | Very Low | 20-100ms serve-worker         |
| 10  | Routes cache warming                  | No              | Very Low | Eliminates TTL gaps           |
| 11  | Eliminate duplicate auth parsing      | No              | Low      | ~0.5ms per request            |
| 12  | Eliminate duplicate account lookups   | No              | Low      | 20-50ms per request           |
| 13  | Parallelize resolveAccountContext     | No              | Low      | 40-100ms agency requests      |
| 14  | Extract site authorization middleware | No              | Low      | Code quality (DRY)            |
| 15  | Single query for crawl+captureMode    | No              | Low      | 20-40ms getSite               |
| 16  | Concurrency limit for listSites       | No              | Low      | Stability for large accounts  |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (No Behavior Change)

1. Lazy environment validation
2. Edge Runtime for preview routes
3. Parallel manifest + dictionary fetch
4. Parallelize resolveAccountContext

### Phase 2: Auth Optimization

5. Web Crypto API migration
6. Parallel auth bootstrap (weblingo_website)
7. Eliminate duplicate auth parsing (webhooks-worker)

### Phase 3: DRY Refactors

8. Eliminate duplicate account lookups
9. Extract site authorization middleware
10. Concurrency limit for listSites

### Phase 4: Webhook Improvements

11. Idempotency check
12. Use Supabase SDK
13. Acknowledge first, process later

### Phase 5: Architectural (Optional)

14. Routes cache warming
15. Single query for crawl+captureMode
16. Move webhook processing to Cloudflare Worker
