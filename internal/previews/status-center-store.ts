import { hasUnresolvedRoutePlaceholder } from "@internal/core/route-placeholders";
import {
  isActivePreviewJobPhase,
  isPreviewJobPhase,
  isPreviewJobTerminal,
  parsePreviewRetryHint,
  reducePreviewJob,
  resolvePreviewRetryHintDelayMs,
  type PreviewJob,
  type PreviewJobEvent,
  type PreviewJobPatch,
  type PreviewJobPhase,
  type PreviewJobUpsertInput,
} from "./preview-job-machine";
import {
  isPreviewErrorCode,
  isPreviewStage,
  type PreviewErrorCode,
  type PreviewStage,
} from "./preview-sse";

export const PREVIEW_STATUS_CENTER_STORAGE_KEY = "weblingo:preview-jobs:v2";
export const LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY = "weblingo:preview-status-center:v1";
export const LEGACY_PENDING_PREVIEW_STORAGE_KEY = "weblingo:try-form:pending-preview:v1";
export const ACTIVE_PREVIEW_SESSION_STORAGE_KEY = "weblingo:try-form:active-preview-id:v1";
export const DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS = 5_000;
export const RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS = 15 * 60 * 1000;
// Client-side backstop for active jobs. The backend reaper terminalizes stalled
// prospect showcases after PROSPECT_SHOWCASE_PROCESSING_TIMEOUT_SECONDS (recommended
// 3600s) plus up to one 15-minute cron interval, and that server verdict arrives via
// polling. This budget must exceed that window (60 + 15 = 75 minutes) with margin
// for cron jitter and clock skew, so the client never fabricates a failure for a
// job the server still considers live; it only catches jobs whose server truth is
// unreachable (see STALE_FAIL_MIN_FAILED_VERIFICATIONS).
export const PREVIEW_ACTIVE_JOB_MAX_AGE_MS = 90 * 60 * 1000;
// Server truth wins: an over-budget active job may have completed successfully
// while the tab slept, so it is never stale-failed before /status has been
// consulted. The stall verdict is fabricated only after this many consecutive
// failed verification attempts show the server is unreachable.
const STALE_FAIL_MIN_FAILED_VERIFICATIONS = 3;
const PREVIEW_STATUS_CENTER_REQUEST_KEY_PREFIX = "v2:";
const PROSPECT_SHOWCASE_REQUEST_KEY_KIND = "prospect_showcase";
const MAX_PREVIEW_STATUS_CENTER_JOBS = 20;
const STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS = 24 * 60 * 60 * 1000;

export type PreviewStatusCenterJobStatus = PreviewJobPhase;
export type PreviewStatusCenterJob = PreviewJob;
export type PreviewStatusCenterJobInput = PreviewJobUpsertInput;
export type PreviewStatusCenterJobPatch = PreviewJobPatch;
export type { PreviewRetryHint } from "./preview-job-machine";

export type PreviewStatusCenterState = {
  jobs: PreviewStatusCenterJob[];
};

export type ParsedPreviewStatusCenterRequestKey = {
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  email: string;
};

export type PreviewStatusCenterStoreEvent =
  | {
      type: "upsert_job";
      input: PreviewStatusCenterJobInput;
    }
  | {
      type: "patch_job";
      previewId: string;
      patch: PreviewStatusCenterJobPatch;
    }
  | {
      type: "mark_terminal";
      previewId: string;
      status: Extract<PreviewStatusCenterJobStatus, "ready" | "failed" | "expired">;
      patch?: Omit<PreviewStatusCenterJobPatch, "status">;
    }
  | {
      type: "set_retry";
      previewId: string;
      retryCount: number;
      delayMs: number;
    }
  | {
      type: "reset_retry";
      previewId: string;
    }
  | {
      type: "remove_job";
      previewId: string;
    }
  | {
      type: "cleanup";
    };

type Listener = () => void;

type ReadJobsResult = {
  jobs: PreviewStatusCenterJob[];
  unknownPhaseDrops: number;
};

const listeners = new Set<Listener>();
const EMPTY_PREVIEW_STATUS_CENTER_JOBS: PreviewStatusCenterJob[] = [];
const SERVER_PREVIEW_STATUS_CENTER_SNAPSHOT: PreviewStatusCenterState = {
  jobs: EMPTY_PREVIEW_STATUS_CENTER_JOBS,
};

let hydrated = false;
let state: PreviewStatusCenterState = {
  jobs: [],
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

// sessionStorage writes do not notify the writing tab, so pin readers subscribe
// to this in-tab event (via useSyncExternalStore) to re-render on pin changes.
const ACTIVE_PREVIEW_PIN_EVENT = "weblingo:active-preview-pin-changed";

function emitActivePreviewPinChange() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(new Event(ACTIVE_PREVIEW_PIN_EVENT));
  } catch {
    // Ignore dispatch failures; the pin is a best-effort UI hint.
  }
}

export function subscribeActivePreviewPin(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(ACTIVE_PREVIEW_PIN_EVENT, listener);
  return () => {
    window.removeEventListener(ACTIVE_PREVIEW_PIN_EVENT, listener);
  };
}

export function getActivePreviewPinSnapshot(): string | null {
  return readActivePreviewIdFromSession();
}

export function getActivePreviewPinServerSnapshot(): string | null {
  return null;
}

export function readActivePreviewIdFromSession(): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }
  try {
    return window.sessionStorage.getItem(ACTIVE_PREVIEW_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActivePreviewIdToSession(previewId: string) {
  if (!canUseSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.setItem(ACTIVE_PREVIEW_SESSION_STORAGE_KEY, previewId);
  } catch {
    // Ignore storage failures; local preview status still works without tab pinning.
  }
  emitActivePreviewPinChange();
}

export function clearActivePreviewIdFromSession(previewId?: string | null) {
  if (!canUseSessionStorage()) {
    return;
  }
  try {
    if (
      !previewId ||
      window.sessionStorage.getItem(ACTIVE_PREVIEW_SESSION_STORAGE_KEY) === previewId
    ) {
      window.sessionStorage.removeItem(ACTIVE_PREVIEW_SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
  emitActivePreviewPinChange();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLangTagForRequestKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEmailForRequestKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function decodeRequestKeyPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildPreviewStatusCenterRequestKey(input: {
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  email?: string | null;
}): string {
  const parts = [
    PROSPECT_SHOWCASE_REQUEST_KEY_KIND,
    input.sourceUrl.trim(),
    normalizeLangTagForRequestKey(input.sourceLang),
    normalizeLangTagForRequestKey(input.targetLang),
    normalizeEmailForRequestKey(input.email),
  ];
  return `${PREVIEW_STATUS_CENTER_REQUEST_KEY_PREFIX}${parts
    .map((part) => encodeURIComponent(part))
    .join("|")}`;
}

export function parsePreviewStatusCenterRequestKey(
  requestKey: string,
): ParsedPreviewStatusCenterRequestKey | null {
  if (requestKey.startsWith(PREVIEW_STATUS_CENTER_REQUEST_KEY_PREFIX)) {
    const encoded = requestKey.slice(PREVIEW_STATUS_CENTER_REQUEST_KEY_PREFIX.length);
    const parts = encoded.split("|");
    const [kind, sourceUrl, sourceLang, targetLang, email = "", ...rest] = parts;
    if (decodeRequestKeyPart(kind) !== PROSPECT_SHOWCASE_REQUEST_KEY_KIND) {
      return null;
    }
    if (!sourceUrl || !sourceLang || !targetLang || rest.length > 0) {
      return null;
    }
    const decodedSourceUrl = decodeRequestKeyPart(sourceUrl);
    const decodedSourceLang = decodeRequestKeyPart(sourceLang);
    const decodedTargetLang = decodeRequestKeyPart(targetLang);
    const decodedEmail = decodeRequestKeyPart(email);
    if (!decodedSourceUrl || !decodedSourceLang || !decodedTargetLang) {
      return null;
    }
    return {
      sourceUrl: decodedSourceUrl,
      sourceLang: decodedSourceLang,
      targetLang: decodedTargetLang,
      email: decodedEmail,
    };
  }
  return null;
}

function resolveCanonicalRequestKey(requestKey: string | null | undefined): string | null {
  const parsed = requestKey ? parsePreviewStatusCenterRequestKey(requestKey) : null;
  if (!parsed) {
    return null;
  }
  return buildPreviewStatusCenterRequestKey({
    sourceUrl: parsed.sourceUrl,
    sourceLang: parsed.sourceLang,
    targetLang: parsed.targetLang,
    email: parsed.email,
  });
}

function parseOptionalPreviewErrorCode(value: unknown): PreviewErrorCode | null {
  return isPreviewErrorCode(value) ? value : null;
}

function parseOptionalPreviewStage(value: unknown): PreviewStage | null {
  return isPreviewStage(value) ? value : null;
}

function resolveHydratedActiveNextPollAt(
  storedNextPollAt: unknown,
  retryHint: PreviewStatusCenterJob["retryHint"],
  createdAt: number,
): number {
  const now = Date.now();
  // Over-budget restored jobs need server truth immediately: the backend may
  // have finished or terminalized the run while no tab was open.
  if (now - normalizeTimestamp(createdAt) >= PREVIEW_ACTIVE_JOB_MAX_AGE_MS) {
    return now;
  }
  if (isFiniteNumber(storedNextPollAt)) {
    return storedNextPollAt;
  }
  const retryHintDelayMs = resolvePreviewRetryHintDelayMs(retryHint);
  return now + (retryHintDelayMs ?? 0);
}

function normalizeJob(job: PreviewStatusCenterJob): PreviewStatusCenterJob {
  const terminal = isPreviewStatusCenterJobTerminal(job.status);
  return {
    ...job,
    previewUrl: sanitizePreviewJobUrl(job.previewUrl),
    demoDashboardUrl: sanitizePreviewJobUrl(job.demoDashboardUrl),
    retryCount: terminal ? 0 : Math.max(0, job.retryCount),
    nextPollAt: terminal
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(job.nextPollAt)
        ? job.nextPollAt
        : Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
    stage: terminal ? null : job.stage,
    retryHint: terminal ? null : job.retryHint,
    remoteStatusVerified: terminal ? true : job.remoteStatusVerified,
  };
}

function sanitizePreviewJobUrl(value: string | null | undefined): string | null {
  if (!value || hasUnresolvedRoutePlaceholder(value)) {
    return null;
  }
  return value;
}

function normalizeTimestamp(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function normalizeNullableTimestamp(value: number | null): number {
  return value === null ? Number.NEGATIVE_INFINITY : normalizeTimestamp(value);
}

function normalizeSortableString(value: string | null | undefined): string {
  return isString(value) ? value : "";
}

function normalizePreviewId(value: string): string {
  return value.trim();
}

export function comparePreviewStatusCenterJobs(
  a: PreviewStatusCenterJob,
  b: PreviewStatusCenterJob,
): number {
  const activeA = isActivePreviewJobPhase(a.status);
  const activeB = isActivePreviewJobPhase(b.status);
  if (activeA !== activeB) {
    return activeA ? -1 : 1;
  }

  const updatedA = normalizeTimestamp(a.updatedAt);
  const updatedB = normalizeTimestamp(b.updatedAt);
  if (updatedA !== updatedB) {
    return updatedB - updatedA;
  }

  const createdA = normalizeTimestamp(a.createdAt);
  const createdB = normalizeTimestamp(b.createdAt);
  if (createdA !== createdB) {
    return createdB - createdA;
  }

  const previewIdDiff = normalizePreviewId(a.previewId).localeCompare(
    normalizePreviewId(b.previewId),
  );
  if (previewIdDiff !== 0) {
    return previewIdDiff;
  }

  const requestKeyDiff = normalizeSortableString(a.requestKey).localeCompare(
    normalizeSortableString(b.requestKey),
  );
  if (requestKeyDiff !== 0) {
    return requestKeyDiff;
  }

  // Full collisions preserve existing persisted order via stable sort / first-match selectors.
  return 0;
}

function parseStoredV2Job(value: unknown): PreviewStatusCenterJob | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isString(value.previewId) ||
    !isString(value.requestKey) ||
    !isString(value.statusToken) ||
    !isString(value.sourceUrl) ||
    !isString(value.sourceLang) ||
    !isString(value.targetLang) ||
    !isPreviewJobPhase(value.status) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  const status = value.status;
  const requestKey = resolveCanonicalRequestKey(value.requestKey);
  if (!requestKey) {
    return null;
  }
  const stage = parseOptionalPreviewStage(value.stage);
  const errorStage = parseOptionalPreviewStage(value.errorStage);
  const retryHint = parsePreviewRetryHint(value.retryHint);

  return normalizeJob({
    previewId: value.previewId,
    requestKey,
    statusToken: value.statusToken,
    // Legacy persisted rows predate the token stamp; their token is at most as
    // fresh as the row itself.
    statusTokenUpdatedAt: isFiniteNumber(value.statusTokenUpdatedAt)
      ? value.statusTokenUpdatedAt
      : value.updatedAt,
    sourceUrl: value.sourceUrl,
    sourceLang: value.sourceLang,
    targetLang: value.targetLang,
    status,
    stage: stage ?? (!isPreviewStatusCenterJobTerminal(status) ? errorStage : null),
    previewUrl: isString(value.previewUrl) ? value.previewUrl : null,
    demoDashboardUrl: isString(value.demoDashboardUrl) ? value.demoDashboardUrl : null,
    error: isString(value.error) ? value.error : null,
    errorCode: parseOptionalPreviewErrorCode(value.errorCode),
    errorStage,
    retryHint,
    remoteStatusVerified: isPreviewStatusCenterJobTerminal(status),
    lastVerifiedAt: isFiniteNumber(value.lastVerifiedAt) ? value.lastVerifiedAt : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: isFiniteNumber(value.expiresAt) ? value.expiresAt : null,
    // Failed-verification counts never carry across sessions: each restore gets
    // fresh /status attempts before the stale-fail backstop may apply.
    retryCount: 0,
    nextPollAt: isPreviewStatusCenterJobTerminal(status)
      ? Number.POSITIVE_INFINITY
      : resolveHydratedActiveNextPollAt(value.nextPollAt, retryHint, value.createdAt),
  });
}

function expireTerminalJob(job: PreviewStatusCenterJob, now: number): PreviewStatusCenterJob {
  if (
    (job.status !== "ready" && job.status !== "failed") ||
    job.expiresAt === null ||
    now < job.expiresAt
  ) {
    return job;
  }
  return normalizeJob({
    ...job,
    status: "expired",
    stage: null,
    previewUrl: null,
    demoDashboardUrl: job.demoDashboardUrl,
    error: job.error,
    errorCode: "preview_expired",
    errorStage: null,
    retryHint: null,
    remoteStatusVerified: true,
    retryCount: 0,
    nextPollAt: Number.POSITIVE_INFINITY,
  });
}

function staleFailActiveJob(job: PreviewStatusCenterJob, now: number): PreviewStatusCenterJob {
  if (isPreviewStatusCenterJobTerminal(job.status)) {
    return job;
  }
  if (now - normalizeTimestamp(job.createdAt) < PREVIEW_ACTIVE_JOB_MAX_AGE_MS) {
    return job;
  }
  // The backend may have terminalized (or completed) this run while no tab was
  // polling. Keep the job active until repeated verification attempts fail so
  // the poll runtime can restore the server verdict instead of this fabricated
  // stall; each failed poll commits a retryCount bump, which re-runs pruning.
  if (job.retryCount < STALE_FAIL_MIN_FAILED_VERIFICATIONS) {
    return job;
  }
  return normalizeJob({
    ...job,
    status: "failed",
    stage: null,
    error: null,
    errorCode: "processing_stalled",
    errorStage: job.stage,
    retryHint: null,
    remoteStatusVerified: true,
    updatedAt: now,
    retryCount: 0,
    nextPollAt: Number.POSITIVE_INFINITY,
  });
}

function pruneJobs(jobs: PreviewStatusCenterJob[], now = Date.now()): PreviewStatusCenterJob[] {
  return (
    jobs
      // TTL-drop on the pre-transformation timestamp: staleFailActiveJob rewrites
      // updatedAt to now, which must not resurrect entries already past the TTL.
      .filter((job) => now - job.updatedAt <= STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS)
      .map((job) => expireTerminalJob(staleFailActiveJob(job, now), now))
      .sort(comparePreviewStatusCenterJobs)
      .slice(0, MAX_PREVIEW_STATUS_CENTER_JOBS)
  );
}

function persistJobs(jobs: PreviewStatusCenterJob[]) {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Ignore localStorage write failures.
  }
}

function clearLegacyStorageKeys() {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_PENDING_PREVIEW_STORAGE_KEY);
  } catch {
    // Ignore localStorage write failures.
  }
}

function commitJobs(nextJobs: PreviewStatusCenterJob[]) {
  state = {
    jobs: pruneJobs(nextJobs),
  };
  persistJobs(state.jobs);
  emit();
}

function resolveUnknownPhase(entry: unknown): string | null {
  if (!isRecord(entry)) {
    return null;
  }
  if (!isString(entry.status)) {
    return null;
  }
  return isPreviewJobPhase(entry.status) ? null : entry.status;
}

function readV2JobsFromStorage():
  | {
      jobs: PreviewStatusCenterJob[];
      unknownPhaseDrops: number;
    }
  | {
      jobs: null;
      unknownPhaseDrops: number;
    } {
  if (!canUseStorage()) {
    return {
      jobs: [],
      unknownPhaseDrops: 0,
    };
  }
  const raw = window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY);
  if (raw === null) {
    return {
      jobs: null,
      unknownPhaseDrops: 0,
    };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        jobs: [],
        unknownPhaseDrops: 0,
      };
    }

    let unknownPhaseDrops = 0;
    const jobs: PreviewStatusCenterJob[] = [];
    for (const entry of parsed) {
      if (resolveUnknownPhase(entry)) {
        unknownPhaseDrops += 1;
      }
      const parsedJob = parseStoredV2Job(entry);
      if (parsedJob) {
        jobs.push(parsedJob);
      }
    }

    return {
      jobs: pruneJobs(jobs),
      unknownPhaseDrops,
    };
  } catch {
    return {
      jobs: [],
      unknownPhaseDrops: 0,
    };
  }
}

function readJobsFromStorage(): ReadJobsResult {
  const v2Result = readV2JobsFromStorage();
  if (v2Result.jobs !== null) {
    return {
      jobs: v2Result.jobs,
      unknownPhaseDrops: v2Result.unknownPhaseDrops,
    };
  }
  return {
    jobs: [],
    unknownPhaseDrops: 0,
  };
}

function ensureHydrated() {
  if (hydrated) {
    return;
  }
  hydrated = true;

  const { jobs, unknownPhaseDrops } = readJobsFromStorage();
  state = {
    jobs,
  };

  clearLegacyStorageKeys();

  if (unknownPhaseDrops > 0) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Dropped preview jobs with unknown phase during hydration",
        dropped_jobs: unknownPhaseDrops,
      }),
    );
  }
}

function applyPreviewJobEvent(previewId: string, event: PreviewJobEvent) {
  const index = state.jobs.findIndex((job) => job.previewId === previewId);
  const existing = index >= 0 ? state.jobs[index] : null;
  const next = reducePreviewJob(existing, event, {
    now: Date.now(),
    defaultPollIntervalMs: DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  });

  if (!next) {
    return;
  }

  if (index < 0) {
    commitJobs([normalizeJob(next), ...state.jobs]);
    return;
  }

  commitJobs(state.jobs.map((job, jobIndex) => (jobIndex === index ? normalizeJob(next) : job)));
}

export function hydratePreviewStatusCenterStore() {
  const wasHydrated = hydrated;
  ensureHydrated();
  if (!wasHydrated) {
    emit();
  }
}

/**
 * Re-reads the persisted snapshot after another tab committed it (localStorage
 * `storage` event). Storage decides membership by default; callers doing a
 * local pre-poll refresh may preserve local-only jobs so caught localStorage
 * write failures do not erase this tab's in-memory run. Storage-event callers
 * may keep only this tab's active session pin for the same reason while still
 * allowing unpinned cross-tab removals. For jobs known locally, the newer
 * `updatedAt` wins the row, but the status token is merged separately by
 * `statusTokenUpdatedAt`: a token rotated by a duplicate submission in another
 * tab must replace the stale local token even when this tab applied later
 * SSE/poll progress, or every future poll here keeps using the revoked token.
 */
export function rehydratePreviewStatusCenterStoreFromStorage(
  options: { preserveLocalJobs?: boolean; preservePinnedActiveLocalJob?: boolean } = {},
) {
  if (!canUseStorage()) {
    return;
  }
  if (!hydrated) {
    hydratePreviewStatusCenterStore();
    return;
  }
  const { jobs: storedJobs } = readJobsFromStorage();
  const localByPreviewId = new Map(state.jobs.map((job) => [job.previewId, job]));
  const storedPreviewIds = new Set(storedJobs.map((job) => job.previewId));
  const pinnedPreviewId =
    options.preservePinnedActiveLocalJob === true ? readActivePreviewIdFromSession() : null;
  const merged = storedJobs.map((incoming) => {
    const local = localByPreviewId.get(incoming.previewId);
    if (!local) {
      return incoming;
    }
    const incomingTerminal = isPreviewStatusCenterJobTerminal(incoming.status);
    const localTerminal = isPreviewStatusCenterJobTerminal(local.status);
    const base =
      incomingTerminal !== localTerminal
        ? incomingTerminal
          ? incoming
          : local
        : normalizeTimestamp(incoming.updatedAt) > normalizeTimestamp(local.updatedAt)
          ? incoming
          : local;
    let merged = base;
    if (incoming.statusToken !== local.statusToken) {
      // Equal stamps with different tokens should not happen; trust the shared
      // snapshot over this tab's memory in that case.
      const tokenWinner =
        normalizeTimestamp(incoming.statusTokenUpdatedAt) >=
        normalizeTimestamp(local.statusTokenUpdatedAt)
          ? incoming
          : local;
      if (tokenWinner !== merged) {
        merged = {
          ...merged,
          statusToken: tokenWinner.statusToken,
          statusTokenUpdatedAt: tokenWinner.statusTokenUpdatedAt,
        };
      }
    }

    const verifiedAt = Math.max(
      normalizeNullableTimestamp(incoming.lastVerifiedAt),
      normalizeNullableTimestamp(local.lastVerifiedAt),
    );
    if (verifiedAt > normalizeNullableTimestamp(merged.lastVerifiedAt)) {
      merged = {
        ...merged,
        lastVerifiedAt: verifiedAt,
      };
    }
    return merged;
  });
  for (const local of state.jobs) {
    if (storedPreviewIds.has(local.previewId)) {
      continue;
    }
    if (options.preserveLocalJobs === true) {
      merged.push(local);
      continue;
    }
    if (
      pinnedPreviewId &&
      local.previewId === pinnedPreviewId &&
      isPreviewStatusCenterJobActive(local)
    ) {
      merged.push(local);
    }
  }
  // Never persist here: echoing the merged snapshot back to localStorage would
  // ping-pong storage events between tabs.
  state = {
    jobs: pruneJobs(merged),
  };
  emit();
}

export function subscribePreviewStatusCenterStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPreviewStatusCenterSnapshot(): PreviewStatusCenterState {
  return state;
}

export function getPreviewStatusCenterServerSnapshot(): PreviewStatusCenterState {
  return SERVER_PREVIEW_STATUS_CENTER_SNAPSHOT;
}

export function getPreviewStatusCenterJobsSnapshot(): PreviewStatusCenterJob[] {
  return state.jobs;
}

export function getPreviewStatusCenterServerJobsSnapshot(): PreviewStatusCenterJob[] {
  return EMPTY_PREVIEW_STATUS_CENTER_JOBS;
}

export function isPreviewStatusCenterJobTerminal(status: PreviewStatusCenterJobStatus): boolean {
  return isPreviewJobTerminal(status);
}

export function isPreviewStatusCenterJobActive(job: PreviewStatusCenterJob): boolean {
  return !isPreviewStatusCenterJobTerminal(job.status);
}

// The marketing status center mirrors only the single current run so it can never
// disagree with the try form: the session-pinned job when it is active, the latest
// active job only when this tab has no known pin, else nothing. Terminal outcomes
// are owned by the form + email.
export function selectCurrentActivePreviewStatusCenterJob(options: {
  jobs: PreviewStatusCenterJob[];
  pinnedPreviewId: string | null;
}): PreviewStatusCenterJob | null {
  if (options.pinnedPreviewId) {
    const pinned = options.jobs.find((job) => job.previewId === options.pinnedPreviewId);
    if (pinned) {
      return isPreviewStatusCenterJobActive(pinned) ? pinned : null;
    }
  }
  return selectLatestActivePreviewStatusCenterJob(options.jobs);
}

export function selectLatestActivePreviewStatusCenterJob(
  jobs: PreviewStatusCenterJob[] = state.jobs,
): PreviewStatusCenterJob | null {
  let best: PreviewStatusCenterJob | null = null;
  for (const job of jobs) {
    if (isPreviewStatusCenterJobTerminal(job.status)) {
      continue;
    }
    if (!best || comparePreviewStatusCenterJobs(job, best) < 0) {
      best = job;
    }
  }
  return best;
}

function isRestorableActivePreviewStatusCenterJob(
  job: PreviewStatusCenterJob,
  now: number,
): boolean {
  if (!isPreviewStatusCenterJobActive(job)) {
    return false;
  }
  const createdAt = normalizeTimestamp(job.createdAt);
  return (
    createdAt !== Number.NEGATIVE_INFINITY &&
    now - createdAt <= RESTORABLE_ACTIVE_PREVIEW_MAX_AGE_MS
  );
}

function isRestorablePreviewStatusCenterJob(job: PreviewStatusCenterJob, now: number): boolean {
  return (
    isPreviewStatusCenterJobTerminal(job.status) ||
    isRestorableActivePreviewStatusCenterJob(job, now)
  );
}

function isPinnedRestorablePreviewStatusCenterJob(job: PreviewStatusCenterJob): boolean {
  return isPreviewStatusCenterJobTerminal(job.status) || isPreviewStatusCenterJobActive(job);
}

export function selectRestorablePreviewStatusCenterJob(
  options: {
    jobs?: PreviewStatusCenterJob[];
    currentRequestKey?: string | null;
    pinnedPreviewId?: string | null;
    now?: number;
  } = {},
): PreviewStatusCenterJob | null {
  const jobs = options.jobs ?? state.jobs;
  const now = options.now ?? Date.now();

  if (options.pinnedPreviewId) {
    const pinned = jobs.find((job) => job.previewId === options.pinnedPreviewId);
    if (pinned && isPinnedRestorablePreviewStatusCenterJob(pinned)) {
      return pinned;
    }
  }

  if (options.currentRequestKey) {
    let best: PreviewStatusCenterJob | null = null;
    for (const job of jobs) {
      if (job.requestKey !== options.currentRequestKey) {
        continue;
      }
      if (!isRestorablePreviewStatusCenterJob(job, now)) {
        continue;
      }
      if (!best || comparePreviewStatusCenterJobs(job, best) < 0) {
        best = job;
      }
    }
    return best;
  }

  let bestActive: PreviewStatusCenterJob | null = null;
  let bestTerminal: PreviewStatusCenterJob | null = null;
  for (const job of jobs) {
    if (isRestorableActivePreviewStatusCenterJob(job, now)) {
      if (!bestActive || comparePreviewStatusCenterJobs(job, bestActive) < 0) {
        bestActive = job;
      }
      continue;
    }
    if (isPreviewStatusCenterJobTerminal(job.status)) {
      if (!bestTerminal || comparePreviewStatusCenterJobs(job, bestTerminal) < 0) {
        bestTerminal = job;
      }
    }
  }
  return bestActive ?? bestTerminal;
}

export function selectPreferredPreviewStatusCenterJob(
  jobs: PreviewStatusCenterJob[] = state.jobs,
): PreviewStatusCenterJob | null {
  let best: PreviewStatusCenterJob | null = null;
  for (const job of jobs) {
    if (!best || comparePreviewStatusCenterJobs(job, best) < 0) {
      best = job;
    }
  }
  return best;
}

export function selectLatestJobByRequestKey(
  requestKey: string | null | undefined,
  jobs: PreviewStatusCenterJob[] = state.jobs,
): PreviewStatusCenterJob | null {
  if (!requestKey) {
    return null;
  }
  let best: PreviewStatusCenterJob | null = null;
  for (const job of jobs) {
    if (job.requestKey !== requestKey) {
      continue;
    }
    if (!best || comparePreviewStatusCenterJobs(job, best) < 0) {
      best = job;
    }
  }
  return best;
}

export function dispatchPreviewStatusCenterEvent(event: PreviewStatusCenterStoreEvent) {
  ensureHydrated();

  if (event.type === "cleanup") {
    commitJobs(state.jobs);
    return;
  }

  if (event.type === "remove_job") {
    commitJobs(state.jobs.filter((job) => job.previewId !== event.previewId));
    return;
  }

  if (event.type === "upsert_job") {
    applyPreviewJobEvent(event.input.previewId, {
      type: "upsert",
      input: event.input,
    });
    return;
  }

  if (event.type === "patch_job") {
    applyPreviewJobEvent(event.previewId, {
      type: "patch",
      patch: event.patch,
    });
    return;
  }

  if (event.type === "mark_terminal") {
    applyPreviewJobEvent(event.previewId, {
      type: "terminal",
      status: event.status,
      patch: event.patch,
    });
    return;
  }

  if (event.type === "set_retry") {
    applyPreviewJobEvent(event.previewId, {
      type: "set_retry",
      retryCount: event.retryCount,
      nextPollAt: Date.now() + Math.max(0, event.delayMs),
    });
    return;
  }

  applyPreviewJobEvent(event.previewId, {
    type: "reset_retry",
    nextPollAt: Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  });
}

export function upsertPreviewStatusCenterJob(input: PreviewStatusCenterJobInput) {
  dispatchPreviewStatusCenterEvent({
    type: "upsert_job",
    input,
  });
}

export function updatePreviewStatusCenterJob(
  previewId: string,
  patch: PreviewStatusCenterJobPatch,
) {
  dispatchPreviewStatusCenterEvent({
    type: "patch_job",
    previewId,
    patch,
  });
}

export function markPreviewStatusCenterJobTerminal(
  previewId: string,
  status: Extract<PreviewStatusCenterJobStatus, "ready" | "failed" | "expired">,
  patch: Omit<PreviewStatusCenterJobPatch, "status"> = {},
) {
  dispatchPreviewStatusCenterEvent({
    type: "mark_terminal",
    previewId,
    status,
    patch,
  });
}

export function removePreviewStatusCenterJob(previewId: string) {
  dispatchPreviewStatusCenterEvent({
    type: "remove_job",
    previewId,
  });
}

export function setPreviewStatusCenterJobRetry(
  previewId: string,
  retryCount: number,
  delayMs: number,
) {
  dispatchPreviewStatusCenterEvent({
    type: "set_retry",
    previewId,
    retryCount,
    delayMs,
  });
}

export function resetPreviewStatusCenterJobRetry(previewId: string) {
  dispatchPreviewStatusCenterEvent({
    type: "reset_retry",
    previewId,
  });
}

export function calculatePreviewStatusCenterRetryDelayMs(retryCount: number): number {
  const cappedRetries = Math.max(0, retryCount);
  const delay = DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS * 2 ** cappedRetries;
  return Math.min(delay, 60_000);
}

export function cleanupPreviewStatusCenterJobs() {
  dispatchPreviewStatusCenterEvent({
    type: "cleanup",
  });
}

export function resetPreviewStatusCenterStoreForTests() {
  hydrated = false;
  state = {
    jobs: [],
  };
  listeners.clear();
}
