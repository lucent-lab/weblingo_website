# Preview status runtime architecture (state machine + unified persistence)

## Scope

This note documents the frontend architecture for persistent preview status across navigation and refresh.

## Storage schema

- Canonical localStorage key: `weblingo:preview-jobs:v2`
- Value: JSON array of preview jobs (most recent first), each containing:
  - identity: `previewId`, `requestKey`, `statusToken`
  - request context: `sourceUrl`, `sourceLang`, `targetLang`
  - state machine fields: `status`, `stage`, `retryCount`, `nextPollAt`
  - outcome fields: `previewUrl`, `error`, `errorCode`, `errorStage`, `expiresAt`
  - timestamps: `createdAt`, `updatedAt`

Retention and bounds:

- max 20 jobs
- TTL 24h from `updatedAt`

## One-time migration behavior

Legacy keys are migrated once when v2 is absent:

- `weblingo:preview-status-center:v1`
- `weblingo:try-form:pending-preview:v1`

Migration flow:

1. Read v1 + pending payloads.
2. Normalize into v2 job shape.
3. Persist to `weblingo:preview-jobs:v2`.
4. Delete legacy keys.

## State machine contract

Allowed phase transitions:

- `pending -> processing|ready|failed|expired`
- `processing -> ready|failed|expired`
- `ready -> ready`
- `failed -> failed`
- `expired -> expired`

Invariants:

- no backward transitions
- terminal phases are absorbing
- stage is monotonic by rank:
  `fetching_page -> analyzing_content -> translating -> generating_preview -> saving`

## Runtime responsibilities

### SSE path

- Used for jobs started in the active tab.
- SSE payloads dispatch store events only.
- On stream error/disconnect:
  - close stream,
  - run one status check,
  - never loop reconnect.

### Polling path

- Implemented in `usePreviewStatusRuntime`.
- Polls `/api/previews/:id` for active jobs based on `nextPollAt`.
- Applies retry/backoff for transient failures.
- Marks terminal on definitive failures (`404`/`410` and explicit failure payloads).
- Handles resume/recovery after refresh/navigation.

## Single-writer rule

All preview job state mutations must go through store events and reducer logic (`dispatchPreviewStatusCenterEvent` -> machine reducer). Components must not mutate persisted state outside this path.

## Selector usage

- Status center list: `selectJobsForStatusCenter()`
- Try form binding: `selectLatestJobByRequestKey(requestKey)`
- Initial restore: `selectLatestActivePreviewStatusCenterJob()`

This keeps form and toast/status-center synchronized from the same source of truth.
