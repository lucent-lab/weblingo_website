Starting CodeRabbit review in plain text mode...

Connecting to review service
Setting up
Analyzing
Reviewing

============================================================================
File: test-results/.last-run.json
Line: 1 to 4
Type: potential_issue

Prompt for AI Agent:
In @test-results/.last-run.json around lines 1 - 4, Remove the auto-generated test artifact by deleting test-results/.last-run.json from the commit, add test-results/ to .gitignore to prevent future commits of test artifacts, and if the file is already tracked remove it from the Git index so it stays locally but is no longer versioned before committing the .gitignore change.

============================================================================
File: app/dashboard/agency/actions.ts
Line: 39 to 41
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/agency/actions.ts around lines 39 - 41, The current email check in the conditional (if (!email || !email.includes("@")) { return failed("Enter a valid customer email."); }) is too permissive; replace it with a stricter validation using a simple regex (for example /^[^\s@]+@[^\s@]+\.[^\s@]+$/) or call a shared validateEmail helper, and return the same failed(...) message when the regex/test fails so malformed values like "@" or "a@" are rejected; ensure the change is applied where the conditional lives in actions.ts (the if block that calls failed(...)).

============================================================================
File: app/dashboard/agency/customer-invite-form.tsx
Line: 40 to 48
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/agency/customer-invite-form.tsx around lines 40 - 48, The email Input component (name="email") and the plan select (name="customerPlan") lack accessible labels; add either explicit elements tied to each control via matching id/htmlFor (e.g., give the Input an id like "email" and the select an id like "customerPlan") or add descriptive aria-label attributes (e.g., aria-label="Customer email" and aria-label="Customer plan") so screen readers announce the controls; if using visual labels, use a visually-hidden class for screen-reader-only text to keep the current layout while ensuring accessibility.

============================================================================
File: app/auth/login/actions.ts
Line: 48 to 56
Type: potential_issue

Prompt for AI Agent:
In @app/auth/login/actions.ts around lines 48 - 56, The current branch in the action handling checks normalized error text and returns a different message for signup ("Unable to create account. Try logging in instead.") which leaks whether an email is registered; change the logic in the conditional that checks normalized.includes("user already registered")/("already registered")/("already exists") so it returns a generic, non-enumerating message regardless of the value of action (use the same message for both "signup" and other actions, e.g., a neutral notice like "If an account exists for this email you will receive an email with next steps" or "Check your email for instructions"), and ensure this change is applied where the variables normalized and action are used (the same conditional block) so both signup and login paths no longer reveal account existence.

============================================================================
File: app/dashboard/\_lib/workspace-actions.ts
Line: 43 to 48
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/\_lib/workspace-actions.ts around lines 43 - 48, The cookie set call for SUBJECT_ACCOUNT_COOKIE via cookieStore.set is missing the secure flag; update the options in the cookieStore.set(SUBJECT_ACCOUNT_COOKIE, subjectAccountId, {...}) call to include secure: process.env.NODE_ENV === 'production' (or an equivalent runtime check for production) so the cookie is only sent over HTTPS in production, keeping the existing httpOnly, sameSite, and path options unchanged.

============================================================================
File: app/dashboard/ops/page.tsx
Line: 79 to 84
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/ops/page.tsx around lines 79 - 84, The render for InfoRow with label "Latest crawl" can show "undefined" or "null" if latest.pagesDiscovered is missing; update the value expression in the InfoRow usage so pagesDiscovered is checked for null/undefined and a friendly fallback is shown (e.g., use a conditional or nullish-coalescing on latest.pagesDiscovered and display either " discovered" when present or "—" when absent). Refer to the InfoRow component and the latest variable in this JSX and replace the inline interpolation with a conditional that only appends "discovered" when latest.pagesDiscovered is not null/undefined.

============================================================================
File: app/dashboard/agency/actions.ts
Line: 26 to 30
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/agency/actions.ts around lines 26 - 30, The formatting of planStatus in formatAgencyBillingMessage uses String.prototype.replace which only replaces the first underscore; update formatAgencyBillingMessage to replace all underscores in auth.actorAccount?.planStatus (or the default "inactive") by using replaceAll("_", " ") or a global regex like .replace(/_/g, " ") so values like "past_due_invoice" become "past due invoice" before building the returned string.

============================================================================
File: app/dashboard/no-account/page.tsx
Line: 50 to 54
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/no-account/page.tsx around lines 50 - 54, The page currently renders the raw error string from the URL (variable error) which is user-controlled; replace this by reading the raw query value (e.g., rawError or the search param you use) and mapping it to a whitelist of predefined messages (create an errorMessages: Record mapping for known keys like "claim_failed", "session_expired"), then set error = rawError ? (errorMessages[rawError] ?? "An unexpected error occurred.") : null and render that mapped message instead of the raw string; keep the existing JSX that displays the error but ensure the fallback message covers unknown values.

============================================================================
File: app/api/dashboard/sites/[siteId]/status/route.ts
Line: 14
Type: potential_issue

Prompt for AI Agent:
In @app/api/dashboard/sites/[siteId]/status/route.ts at line 14, The code uses a non-null assertion on auth.webhooksAuth when assigning token (const token = auth.webhooksAuth!), which can crash if requireDashboardAuth() returns an auth object with webhooksAuth undefined/null; update the handler that calls requireDashboardAuth() to explicitly check auth.webhooksAuth (or auth) and, if missing, return an appropriate HTTP error response (e.g., 401/400 with a descriptive message) instead of using the ! operator; locate the usage of requireDashboardAuth and the token variable in route.ts and replace the non-null assertion with a guard that handles the missing credential path.

============================================================================
File: app/dashboard/agency/actions.ts
Line: 67 to 72
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/agency/actions.ts around lines 67 - 72, The catch block in the agency invite flow returns raw error.message to the client (in the catch inside the createAgencyCustomer call), which can leak internals; instead, log the full error server-side (e.g., via console.error or the existing logger) including the Error object, and change the returned failed(...) to a generic user-facing string like "Unable to invite customer." while still preserving the original error for logs; update the catch handling around createAgencyCustomer / the function containing failed(...) so it only returns the generic message to callers and logs the full error details.

============================================================================
File: docs/plans/dashboard-openapi-onboarding-revamp.md
Line: 75 to 77
Type: potential_issue

Prompt for AI Agent:
In @docs/plans/dashboard-openapi-onboarding-revamp.md around lines 75 - 77, The POST /sites endpoint must enforce plan and locale limits server-side: in the site creation handler (e.g., SitesController.createSite or create_site API route) validate the incoming sitePlan and maxLocales against the authenticated user's entitlements (from accounts/me or AccountService.getQuotas) and reject with a 4xx error if the request exceeds allowed limits or is inconsistent (e.g., maxLocales=null for a plan that disallows it); add unit/integration tests and error responses so callers (and the UI) receive clear rejection reasons rather than relying solely on client-side checks.

============================================================================
File: app/error/error-page-client.tsx
Line: 74 to 83
Type: potential_issue

Prompt for AI Agent:
In @app/error/error-page-client.tsx around lines 74 - 83, The trace string rendered in the block (variable trace in error-page-client.tsx) comes from URL params and should be restricted: only render it when not in production (guard with NODE_ENV/isProd flag), sanitize it before rendering (use a trusted sanitizer like DOMPurify or at minimum escape/control characters), truncate it to a safe length (e.g., 1–2k chars) to avoid deceptive long messages, and add a clear visual indicator/label such as “User-provided debug info” with muted styling so users know it’s untrusted; update the conditional that renders the (the trace block) to apply these checks/transforms.

============================================================================
File: internal/dashboard/entitlements.ts
Line: 126 to 137
Type: potential_issue

Prompt for AI Agent:
In @internal/dashboard/entitlements.ts around lines 126 - 137, The allFeatures branch currently always reports requirement.allFeatures[0] as the failing feature; change it to compute the actual failing feature by finding the first feature for which FEATURE_FLAG_BY_FEATURE[feature] maps to a key where account.featureFlags[key] !== true (e.g., use Array.prototype.find on requirement.allFeatures to get the failedFeature) and return reason { kind: "feature", feature: failedFeature } (fall back to a safe value if none found). Update the block around the existing const ok = ... and the returned failure object so it uses that computed failed feature instead of requirement.allFeatures[0].

============================================================================
File: internal/dashboard/entitlements.ts
Line: 158 to 168
Type: potential_issue

Prompt for AI Agent:
In @internal/dashboard/entitlements.ts around lines 158 - 168, The "allPreviews" branch currently reports requirement.allPreviews[0] on failure instead of the actual missing preview; update the logic in the "allPreviews" handling (the block that computes ok and returns { ok: false, reason: { kind: "preview", preview: ... } }) to find the first preview that is not present in account.featureFlags.featurePreview (e.g., use Array.find to locate the failing preview) and use that failing value in the reason.preview field while preserving the existing error for empty arrays and the return shape.

============================================================================
File: internal/i18n/messages/ja.json
Line: 82
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/messages/ja.json at line 82, Replace the misspelled domain "webligno.app" with the correct "weblingo.app" in all affected i18n message entries: update the values for keys "contact.direct.description", "legal.terms.sections.operator.list", "legal.privacy.sections.controller.list", "legal.privacy.sections.rights.body", and "legal.notice.sections.operator.list" (and any other occurrences) so the email/domain reads correctly as weblingo.app.

============================================================================
File: app/api/previews/[id]/route.ts
Line: 3 to 4
Type: potential_issue

Prompt for AI Agent:
In @app/api/previews/[id]/route.ts around lines 3 - 4, The environment variables are using NEXT*PUBLIC* prefixes which expose them to the client; change the usages to server-only names (e.g., replace NEXT*PUBLIC_WEBHOOKS_API_BASE with WEBHOOKS_API_BASE and NEXT_PUBLIC_TRY_NOW_TOKEN with TRY_NOW_TOKEN) in this file so API_BASE and PREVIEW_TOKEN are read from process.env without the NEXT_PUBLIC* prefix, and update your .env files accordingly; ensure no other client-side code depends on the public names and restart the server after updating env vars.

============================================================================
File: app/dashboard/sites/[id]/pages/crawl-summary.client.tsx
Line: 115 to 130
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/sites/[id]/pages/crawl-summary.client.tsx around lines 115 - 130, Numeric fields like latestCrawlRun.pagesDiscovered, pagesEnqueued, selectedCount, and skippedDueToLimitCount can be null/undefined; update the JSX to use optional chaining with nullish coalescing so the UI shows a safe fallback (e.g. 0 or '-' as agreed) instead of blank/"undefined" — for example replace each direct access with latestCrawlRun?.pagesDiscovered ?? 0 (and similarly for pagesEnqueued, selectedCount, skippedDueToLimitCount).

============================================================================
File: components/auth-login-form.tsx
Line: 114 to 119
Type: potential_issue

Prompt for AI Agent:
In @components/auth-login-form.tsx around lines 114 - 119, The support mailto link currently uses the incorrect domain "contact@webligno.app" in the JSX anchor inside the auth login form paragraph; update the href and visible email text to the correct domain "contact@weblingo.app" (i.e., change the string in the tag that currently reads "mailto:contact@webligno.app" and its inner text if it displays the email) so the Contact support link points to contact@weblingo.app.

============================================================================
File: internal/i18n/messages/en.json
Line: 274
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/messages/en.json at line 274, There’s a repeated typo of the domain string "webligno.app" in the legal translation entries; find the affected keys in internal/i18n/messages/en.json (e.g., "legal.terms.updated" plus the legal/privacy entries referenced around the review lines and the GDPR contact entry) and replace the misspelled domain with the correct domain ("weblingo.app"); also update the GDPR rights contact value so the email uses the corrected domain (e.g., privacy@weblingo.app) so all four occurrences are consistent and the contact address is valid.

============================================================================
File: app/dashboard/layout.tsx
Line: 40
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/layout.tsx at line 40, The current constant email (const email = auth.user?.email ?? "demo@webligno.app") uses a hardcoded demo address; change it to a generic placeholder or environment-aware behavior by replacing the fallback "demo@webligno.app" with something like "Unknown" or an empty string, or wrap the fallback in a NODE_ENV check so the demo address is only used in development (update the const email assignment and any UI that renders it to handle the new placeholder gracefully).

============================================================================
File: internal/i18n/messages/en.json
Line: 82
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/messages/en.json at line 82, The string key "contact.direct.description" contains a typo in the support email domain; update the value so the email uses the correct domain "weblingo.app" (i.e., change contact@webligno.app to contact@weblingo.app) to match the product name and ensure users can reach support.

============================================================================
File: app/api/previews/[id]/stream/route.ts
Line: 15 to 23
Type: potential_issue

Prompt for AI Agent:
In @app/api/previews/[id]/stream/route.ts around lines 15 - 23, The upstream fetch call (const upstream = await fetch(${API_BASE}/previews/${encodeURIComponent(id)}/stream, { ... , signal: \_request.signal })) lacks error handling; wrap this fetch in a try/catch to handle thrown network errors (timeouts, DNS failures) and check upstream.ok to handle non-2xx responses, log the error/response details (include id, API_BASE, PREVIEW_TOKEN masked if needed), and return an appropriate Response to the client (with status and meaningful message) instead of letting the exception propagate.

============================================================================
File: app/[locale]/pricing/page.tsx
Line: 236 to 241
Type: potential_issue

Prompt for AI Agent:
In @app/[locale]/pricing/page.tsx around lines 236 - 241, The current plan.features.map callback uses the translated feature string as the React key which can produce duplicate-key warnings if translations collide; in the plan.features.map((feature) => ...) block replace the key usage with a stable identifier (e.g., feature.id or featureKey) if each feature object has one, otherwise use the index from map (map((feature, idx) => ...) and set key to idx) to ensure unique keys for each containing the Check and feature text.

============================================================================
File: components/site-footer.tsx
Line: 46 to 48
Type: potential_issue

Prompt for AI Agent:
In @components/site-footer.tsx around lines 46 - 48, The translation key for the legal notice link is inconsistent: change the t("nav.legal") call used inside the Link element rendering the legal notice to a footer-scoped key (e.g., t("footer.notice") or t("footer.legalNotice")) to match the other keys (footer.contact, footer.terms, footer.privacy); update the string passed to the t() call in the Link element so the translation namespace is consistent and accurately describes the /legal/notice destination.

============================================================================
File: app/dashboard/agency/customers/page.tsx
Line: 66 to 97
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/agency/customers/page.tsx around lines 66 - 97, Labels are not associated with their controls; add id attributes to the form controls and htmlFor on their labels: give the Search label an htmlFor matching an id passed to the Input component (e.g., id="query"), and give the Plan and Status select elements explicit ids (e.g., id="plan" and id="status") and update their corresponding label htmlFor attributes to match; ensure the Input component usage passes the id prop so the rendered input gets the id, and keep the existing name attributes (name="query", name="plan", name="status") unchanged.

============================================================================
File: internal/dashboard/auth.ts
Line: 322 to 324
Type: potential_issue

Prompt for AI Agent:
In @internal/dashboard/auth.ts around lines 322 - 324, The catch around the "subject account exchange" currently just console.warns and silently falls back to the actor; change it to record the failure and surface it: replace the silent warn in the catch with (1) richer logging (include the error) and (2) set a visible fallback indicator on the returned context/session object (e.g., add a boolean like subjectFallbackToActor or attach an error field) or rethrow a specific error that callers can display; update the exchange callsite(s) to check that flag/field and render an appropriate UI message instead of silently showing actor data.

============================================================================
File: app/dashboard/layout.tsx
Line: 265
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/layout.tsx at line 265, The code uses a non-null assertion auth.webhooksAuth! when calling listSitesCached which can throw before the call if webhooksAuth is undefined; update the branch to first check that auth.webhooksAuth is defined (e.g., if (!auth.webhooksAuth) handle the missing auth by throwing a controlled error, returning an empty sites list, or logging and skipping), then pass the validated value into listSitesCached; reference the auth object and the listSitesCached call so you replace the direct non-null assertion with an explicit guard and a safe code path.

============================================================================
File: internal/i18n/messages/en.json
Line: 127
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/messages/en.json at line 127, Update the English i18n entry for "dashboard.site.settings.clientRuntime.label" (and any other en.json entries) to use the correct product capitalization "WebLingo" instead of "Weblingo"; search the en.json file for any other occurrences of "Weblingo" and replace them with "WebLingo" to keep branding consistent across all message keys/values.

============================================================================
File: components/auth-login-form.tsx
Line: 83 to 90
Type: potential_issue

Prompt for AI Agent:
In @components/auth-login-form.tsx around lines 83 - 90, The password Input currently uses a static autoComplete="current-password" which is wrong for signup; update the Input (id/name "password") to set autoComplete dynamically based on the form intent (e.g., use "new-password" for signup/account creation and "current-password" for login). Locate the component that renders the Input in components/auth-login-form.tsx and derive intent from the existing prop/state (e.g., intent, mode, or isSignup) and set autoComplete accordingly (intent === 'signup' ? 'new-password' : 'current-password') so password managers and browser generation work correctly for both flows.

============================================================================
File: internal/i18n/lang-tag.ts
Line: 20 to 21
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/lang-tag.ts around lines 20 - 21, The code currently uppercases 3-letter alphabetic subtags; remove the /^[A-Za-z]{3}$/ check so only 2-letter alphabetic subtags are uppercased (keep /^[A-Za-z]{2}$/.test(part) as the condition) and let 3-letter alphabetic subtags fall through to the lowercase/default branch; refer to the variable part and the regex checks (/^[A-Za-z]{2}$/, /^[A-Za-z]{3}$/) in the normalization logic to locate and change the condition.

============================================================================
File: app/dashboard/layout.tsx
Line: 100
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/layout.tsx at line 100, The code uses rawStatusLabel.replace("_", " ") which only replaces the first underscore; update the call to rawStatusLabel.replaceAll("_", " ") so all underscores become spaces when creating statusLabel, and make the identical change at the other occurrence (the second replace call noted in the review) so both places use replaceAll("\_", " ").

============================================================================
File: internal/i18n/messages/fr.json
Line: 82
Type: potential_issue

Prompt for AI Agent:
In @internal/i18n/messages/fr.json at line 82, The JSON contains a typo in the email domain "webligno.app" that should be "weblingo.app"; update the string value for the i18n keys "contact.direct.description", "legal.terms.sections.operator.list", "legal.privacy.sections.controller.list", "legal.privacy.sections.rights.body", and "legal.notice.sections.operator.list" (and any other occurrences) to use "weblingo.app" instead, ensuring you preserve surrounding punctuation and JSON quoting; search the file for "webligno.app" and replace all matches with "weblingo.app".

============================================================================
File: app/dashboard/error.tsx
Line: 83 to 96
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/error.tsx around lines 83 - 96, The stack-trace toggle (button using setShowDetails/showDetails and the pre that prints error.stack) should be hidden in production: wrap the button and pre in a conditional that only renders them when the runtime environment is non-production (e.g., process.env.NODE_ENV !== 'production' or a Next.js runtime flag) so end users cannot reveal raw stacks; alternatively (or additionally) when in production sanitize error.stack before rendering by stripping absolute file paths and other sensitive tokens with a regex or sanitizer function and then render the sanitized string instead of error.stack.

============================================================================
File: app/[locale]/pricing/page.tsx
Line: 225 to 231
Type: potential_issue

Prompt for AI Agent:
In @app/[locale]/pricing/page.tsx around lines 225 - 231, The Checkout Button rendered by the Button component (props: size="lg", className="mb-8 w-full", variant based on highlight) is currently non-functional; either wrap it with a Next.js Link to navigate to the checkout route (e.g., …) or add an onClick handler that performs navigation (useRouter().push('/checkout')) or triggers the checkout flow, and if the checkout flow is not ready set disabled on the Button or provide a placeholder onClick that shows a toast/modal; make the change where Button is declared in pricing/page.tsx.

============================================================================
File: app/dashboard/sites/[id]/pages/page.tsx
Line: 379 to 388
Type: potential_issue

============================================================================
File: internal/dashboard/webhooks.ts
Line: 492 to 500
Type: potential_issue

Prompt for AI Agent:
In @internal/dashboard/webhooks.ts around lines 492 - 500, The recursive retry call inside the request function omits the allowEmptyResponse flag, causing endpoints that expect empty responses (e.g., deleteSite) to fail after a 401 refresh; update the retry invocation inside function request to include the original allowEmptyResponse value (e.g., pass allowEmptyResponse: options.allowEmptyResponse or the local allowEmptyResponse variable) so the recursive call preserves the empty-response behavior.

============================================================================
File: internal/dashboard/site-settings.ts
Line: 215 to 229
Type: potential_issue

Prompt for AI Agent:
In @internal/dashboard/site-settings.ts around lines 215 - 229, The calls to parseSpaRefreshFallback and parseSpaRefreshBoolean can throw and are not currently handled; wrap the block that builds payload.spaRefresh (the parseSpaRefreshFallback calls for "spaRefreshMissingFallback" and "spaRefreshErrorFallback" and parseSpaRefreshBoolean for "spaRefreshEnableSectionScope") in a try-catch, catch any thrown Error, and return a proper SiteSettingsUpdateResult error response (e.g., a failure result with the error message added to validation/errors) instead of letting the exception bubble up so the function preserves its return contract.

============================================================================
File: docs/LOGGING_POLICY.md
Line: 37 to 69
Type: potential_issue

============================================================================
File: components/try-form.tsx
Line: 229 to 234
Type: potential_issue

Prompt for AI Agent:
In @components/try-form.tsx around lines 229 - 234, The handleGenerate function currently omits the email state from the request payload even though an email input is rendered when showEmailField is true; update handleGenerate to include the email value in the body sent (e.g., add email: email or email: email || undefined) when showEmailField is true, and ensure you reference the existing email state and showEmailField flag so the request includes the collected email only when the field is shown (also consider basic trim/validation of email before adding it to the payload).

============================================================================
File: app/dashboard/sites/[id]/pages/page.tsx
Line: 254 to 256
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/sites/[id]/pages/page.tsx around lines 254 - 256, The current table row key uses ${deployment.targetLang}-${deployment.domain ?? "domain"} which can collide when multiple deployments share the same targetLang and a null domain; update the key to use a truly unique identifier from the deployment (e.g., deployment.id) and fall back to a composite that includes the map index if id is missing (replace the JSX key expression on the that currently references deployment.targetLang and deployment.domain).

============================================================================
File: docs/reports/dashboard-review-2026-01-08-gemini.md
Line: 79 to 83
Type: potential_issue

Prompt for AI Agent:
In @docs/reports/dashboard-review-2026-01-08-gemini.md around lines 79 - 83, The FlashToasts component must avoid duplicate toasts and race conditions by tracking which toast payloads have been shown; add a persistent in-component tracker (e.g., shownToasts via useRef(new Set())) and in the useEffect that reads useSearchParams derive a stable toast ID (e.g., full params string or composed toast|error|details) and only show the toast and call router.replace(pathname, { scroll: false }) if that ID is not already in shownToasts, then add it to the set; ensure the effect depends on searchParams, pathname and router and that router.replace is called after adding the ID to prevent duplicates and handle quick re-renders/back-button restores.

============================================================================
File: app/dashboard/sites/new/page.tsx
Line: 61
Type: potential_issue

============================================================================
File: docs/reports/dashboard-review-2026-01-08-gemini.md
Line: 119 to 120
Type: refactor_suggestion

============================================================================
File: docs/reports/slow-dashboard-analysis-2026-01-02.md
Line: 208 to 216
Type: refactor_suggestion

Prompt for AI Agent:
In @docs/reports/slow-dashboard-analysis-2026-01-02.md around lines 208 - 216, Update the Vercel KV section to explicitly define production behavior when the 30,000 reads/month free tier is nearing/exceeded: add a monitoring threshold (e.g., alert at 80% of reads) tied to the KV read metric, document a clear migration path to a paid Vercel KV tier or alternate Redis/Upstash provider, and specify graceful degradation behavior — e.g., fall back to live token re-bootstrap when cache lookups using the envPrefix + ":" + sha256(session.access_token + ":" + subjectAccountIdNormalized) key fail, skip caching when TTL calculation min(300s, expiresAt - now - 60s) is below a clamp (e.g., 30s), and use single-flight/stampede protection to avoid concurrent re-issues; also note operational steps to switch endpoints and update configuration if migrating to another cache.

============================================================================
File: docs/reports/slow-dashboard-analysis-2026-01-02.md
Line: 225 to 235
Type: refactor_suggestion

============================================================================
File: components/ui/sidebar.tsx
Line: 144 to 170
Type: potential_issue

============================================================================
File: app/dashboard/actions.ts
Line: 841 to 846
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/actions.ts around lines 841 - 846, The outer variable updated is shadowed by an inner declaration inside the withWebhooksAuth callback; rename the inner binding to avoid shadowing (e.g., call it updatedSite or result) so the outer const updated receives the returned value from withWebhooksAuth; update references in the callback to use the new name and keep calls to updateSite(auth, siteId, { status }) and invalidateSitesCache(auth) unchanged.

============================================================================
File: app/dashboard/sites/glossary-table.tsx
Line: 45 to 47
Type: potential_issue

Prompt for AI Agent:
In @app/dashboard/sites/glossary-table.tsx around lines 45 - 47, The effect in glossary-table.tsx currently depends on onEntriesChange which can change identity each render and cause an infinite loop; change it to read the callback from a ref so the effect only depends on entries (store onEntriesChange in a ref inside the component and update the ref whenever the prop changes, then inside the useEffect call ref.current?.(entries) with dependencies [entries]) or alternatively document that consumers must memoize the onEntriesChange prop with useCallback; reference the existing useEffect, the onEntriesChange prop, and the entries variable when implementing the ref pattern.

============================================================================
File: docs/reports/weblingo-dashboard-dashboard-16.1.1-implementation-report.md
Line: 330 to 347
Type: potential_issue

Prompt for AI Agent:
In @docs/reports/weblingo-dashboard-dashboard-16.1.1-implementation-report.md around lines 330 - 347, The route handler calls requireDashboardAuth() but doesn't verify the authenticated user actually owns the requested site; after acquiring auth (and using auth.webhooksAuth) and fetching the site via fetchSite(token, siteId), add an explicit authorization check comparing site.userId (or equivalent owner field on the fetched site) to auth.userId and return a 403 JSON error if they differ; alternatively, if requireDashboardAuth() is already expected to enforce ownership, update or document requireDashboardAuth() to accept the siteId and perform this check instead. Ensure the check runs before returning site/deployments and that WebhooksApiError 404 and other error handling remain unchanged.

============================================================================
File: docs/reports/weblingo-dashboard-dashboard-16.1.1-implementation-report.md
Line: 350 to 380
Type: refactor_suggestion

Prompt for AI Agent:
In @docs/reports/weblingo-dashboard-dashboard-16.1.1-implementation-report.md around lines 350 - 380, The usePoll hook spec is missing error/retry and timing semantics; update the implementation of usePoll to (1) perform an immediate fetch when enabled becomes true, (2) treat intervalMs as the delay between the completion of one fetch and the start of the next (i.e., start the next fetch after awaiting fetcher and then waiting intervalMs), (3) on fetcher() rejection set the error state (preserve previous value), console.error the error, and continue polling on the next scheduled tick (no permanent stop or exponential backoff unless opted later), (4) stop polling when isTerminal(value) returns true after a successful fetch, and (5) on unmount clear any timers and cancel/ignore in-flight fetches (use an abort signal or an in-flight token) so no state updates occur after unmount; ensure exported symbols/value names (usePoll, options.fetcher, options.isTerminal, options.intervalMs, value, error, isPolling) reflect this behavior.

============================================================================
File: docs/reports/weblingo-dashboard-dashboard-16.1.1-implementation-report.md
Line: 383 to 410
Type: potential_issue

Review completed ✔
