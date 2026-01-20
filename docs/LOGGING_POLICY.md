# Logging Policy

You MUST follow this logging policy whenever you add or modify code.

## LOGGING GOAL

- Logs must help a human answer: "What happened to this request/unit of work, and why?"
- Logs must be optimized for querying and correlation, NOT for reading as a narrative diary.

## CORE DESIGN (WIDE EVENTS / CANONICAL LOG LINE)

- Emit ONE primary, structured log event per unit of work, per service hop:
  - For HTTP/API: 1 log event per request, emitted at completion.
  - For background jobs / queue messages: 1 log event per job/message, emitted at completion.
  - For long workflows: 1 log event per step/hop (not dozens of step-by-step lines).

- The primary log event MUST be a "wide event":
  - A single record with many fields (high dimensionality) containing all relevant context.
  - It should be the authoritative record of what happened.

- Do NOT scatter 10-50 small log lines like "entered function X" / "doing Y".
  - Prefer enriching the one wide event throughout execution, then emitting once at the end.

## STRUCTURE OVER STRINGS

- Logs MUST be emitted as structured key-value data.
- Do NOT rely on free-text messages as the primary carrier of meaning.
- If you include a message string, it is optional and secondary; the fields are the truth.

## CONSISTENCY RULES (CRITICAL FOR QUERYING)

- Use consistent field names everywhere. Never log the same concept in multiple formats.
  Example: always `user_id`, never sometimes `userId`, sometimes `[USER:...]`, sometimes `user-123`.
- Use stable keys. Don't create dynamic keys like `error_for_${vendor}`.
- Prefer snake_case for keys.

## REQUIRED FIELDS FOR EVERY WIDE EVENT

1. Identity and correlation
   - timestamp (ISO-8601)
   - event_name (low-cardinality, e.g. "http_request", "job_run", "workflow_step")
   - request_id (or job_id / message_id) [high-cardinality]
   - trace_id (if available) [high-cardinality]
   - parent_id / span_id (if available)

2. Execution context
   - service (logical service/component name)
   - environment (prod/staging/dev)
   - version (app version/build)
   - deployment_id (or equivalent rollout identifier)
   - region/zone (if relevant)

3. Operation summary
   - operation (low-cardinality name, e.g. route name, handler name, job name)
   - outcome ("success" | "error" | "rejected" | "cancelled")
   - status_code (for HTTP-like operations; include semantic status if not HTTP)
   - duration_ms (end-to-end time)

4. Actor + business context (choose what applies; include high-signal dimensions)
   - user_id (if exists), account_id/org_id (if exists)
   - user_tier/subscription_plan (if exists)
   - feature_flags / experiment_variants impacting behavior
   - domain entity IDs relevant to the unit of work (e.g. document_id, page_id, translation_id, order_id)

5. Dependency and performance summary (aggregated, not spammy)
   - counts: db_queries, cache_hits/misses, external_calls
   - key latencies: external_call_latency_ms (by dependency), db_time_ms, etc. (aggregated)
   - notable fallbacks/retries (as fields), not as many separate lines

## ERROR OBJECT (ONLY WHEN THERE IS AN ERROR OR FAILURE PATH)

- If outcome != success, include an `error` object with:
  - type (exception/class/category)
  - code (stable, queryable error code; avoid random text)
  - message (sanitized; never secrets; keep short)
  - retriable (true/false)
  - cause/provider (if relevant)
- Include enough detail to debug, but do NOT dump entire payloads or secrets.

## WHEN TO LOG (WHAT/WHEN/HOW)

- ALWAYS log at the boundary of a unit of work:
  - start: initialize an in-memory event object with correlation + request basics
  - during: enrich the event object with business context as it becomes known
  - end: finalize outcome/status/duration and emit exactly one wide event

- Additional log events are allowed ONLY for:
  - state transitions that matter (e.g., circuit breaker opened, queue paused)
  - security/audit-relevant actions (e.g., permission denied, admin action)
  - data integrity anomalies (e.g., invariant broken but recovered)
    These additional events must still be structured and must include correlation IDs.

## WHAT NOT TO LOG

- Never log secrets: tokens, credentials, private keys, session cookies, auth headers.
- Never log raw PII unnecessarily (email, phone, address). Prefer stable IDs.
- Never log full request/response bodies by default.
- Avoid high-volume debug logs in production code paths.
- Avoid per-loop/per-item logs in hot paths; aggregate counts instead.

## SAMPLING (COST CONTROL WITHOUT LOSING IMPORTANT EVENTS)

- Implement tail-style sampling: decide whether to keep/store AFTER the unit finishes.
- Rules:
  1. Keep 100% of errors/failures.
  2. Keep 100% of slow units (above your "too slow" threshold).
  3. Keep 100% of VIP/flagged users/sessions (if such a concept exists).
  4. Sample the remaining successful fast events at a low rate (e.g., 1-5%).
- Sampling must never remove the ability to debug incidents.

## QUALITY BAR / SELF-CHECKLIST (THE LLM MUST DO THIS BEFORE FINISHING)

- Can an on-call person answer "what happened" from ONE event line?
- Does the event contain correlation IDs + the key business identifiers?
- Are field names consistent and queryable?
- Did we avoid secrets/PII and huge payload dumps?
- Did we avoid spammy multi-line logging and instead emit one wide event?
