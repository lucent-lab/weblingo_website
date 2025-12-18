Starting CodeRabbit review in plain text mode...

Connecting to review service
Setting up
Analyzing
Reviewing

============================================================================
File: app/dashboard/\_components/dashboard-nav.tsx
Line: 19 to 21
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/\_components/dashboard-nav.tsx around lines 19 to 21, the active-state check uses pathname.startsWith(item.href) which causes false positives (e.g., "/dashboard-settings" matches "/dashboard"); update the condition to only mark active when pathname equals item.href or when pathname begins with the item.href followed by a slash (e.g., pathname === item.href || pathname.startsWith(${item.href}/)), keeping the null check for pathname.

============================================================================
File: app/dashboard/developer-tools/page.tsx
Line: 79
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/developer-tools/page.tsx around line 79, the Info value is printing the raw expires_at number; convert the Unix timestamp into a human-readable date string before rendering (e.g., create a Date from expires_at (multiply by 1000 if it's in seconds) and format with toLocaleString or Intl.DateTimeFormat) and fall back to "—" when undefined; ensure the formatted output matches the style used by the JWT expiry badge at line 56.

============================================================================
File: app/dashboard/\_lib/webhooks-token.ts
Line: 27 to 30
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/\_lib/webhooks-token.ts around lines 27 to 30, the function discards the expiresAt value from getWebhooksToken which prevents callers from managing token lifecycle; update withWebhooksToken to surface expiresAt — either by (A) changing the callback signature to callback(token: string, expiresAt: string | Date | null) and pass expiresAt through, or (B) returning an object { result, expiresAt } where result is the callback return value; update all internal call sites to match the chosen approach and preserve existing error handling and types.

============================================================================
File: app/dashboard/sites/new/onboarding-form.tsx
Line: 71 to 111
Type: potential_issue

============================================================================
File: app/dashboard/sites/new/onboarding-form.tsx
Line: 38 to 44
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/sites/new/onboarding-form.tsx around lines 38 to 44, the preview logic appends a concrete language ("fr") when {lang} is missing which contradicts form validation that requires {lang}; change it so sampleLang is taken from targets[0] if present or the placeholder "{lang}" when targets is empty, and when pattern does not include "{lang}" append "/{lang}" (not a concrete language) so the preview matches validation; keep the trailing-slash cleanup (replace(/(?<!:)\/{2,}/g, "/")) unchanged.

============================================================================
File: internal/dashboard/webhooks.ts
Line: 145 to 150
Type: potential_issue

Prompt for AI Agent:
internal/dashboard/webhooks.ts around lines 145-150: the code returns parsed as T when no schema is provided which bypasses runtime validation and breaks type safety; change the function to either (preferred) require a validation schema parameter and always validate/transform the parsed response before returning T, or if you must allow no schema, change the return type to unknown (or unknown | null) and return the raw parsed value without assertion so callers must perform validation; ensure existing call sites are updated to either pass a schema or handle the unknown return type, and keep the existing thrown WebhooksApiError for undefined parsed responses.

============================================================================
File: app/dashboard/actions.ts
Line: 237 to 242
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/actions.ts around lines 237 to 242, the formData string extractions for siteId, pageId, lang and path do not trim whitespace; update each extraction to call .toString().trim() (e.g. formData.get("siteId")?.toString().trim()) and ensure the subsequent falsy check still rejects empty or whitespace-only values (so keep the existing if (!siteId || !pageId || !lang || !path) guard).

============================================================================
File: app/dashboard/actions.ts
Line: 212 to 218
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/actions.ts around lines 212 to 218, the form values are read without trimming so whitespace-only strings will pass the required check; update the extractions to trim each value (e.g., call toString().trim() or trim on the string result) and ensure contextHashScope becomes undefined if its trimmed value is empty; also validate the trimmed variables in the existing if check so values that are empty after trimming are treated as missing.

============================================================================
File: app/dashboard/sites/[id]/glossary-editor.tsx
Line: 43 to 49
Type: potential_issue

Prompt for AI Agent:
In app/dashboard/sites/[id]/glossary-editor.tsx around lines 43 to 49, the targetLangs parsing returns an empty array for inputs like ", , ," which should be treated as undefined; after splitting, trimming and filtering, check if the resulting array has length > 0 and return that array only then, otherwise return undefined so the server receives undefined instead of an empty array.

Review completed ✔
