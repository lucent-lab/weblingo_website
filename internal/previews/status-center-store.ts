import {
  isPreviewJobTerminal,
  reducePreviewJob,
  resolveNextPreviewJobPhase,
  type PreviewJob,
  type PreviewJobEvent,
  type PreviewJobPatch,
  type PreviewJobPhase,
  type PreviewJobUpsertInput,
} from "./preview-job-machine";
import { isPreviewErrorCode, isPreviewStage, type PreviewErrorCode, type PreviewStage } from "./preview-sse";

export const PREVIEW_STATUS_CENTER_STORAGE_KEY = "weblingo:preview-jobs:v2";
export const LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY = "weblingo:preview-status-center:v1";
export const LEGACY_PENDING_PREVIEW_STORAGE_KEY = "weblingo:try-form:pending-preview:v1";
export const DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS = 5_000;
const PREVIEW_STATUS_CENTER_REQUEST_KEY_PREFIX = "v2:";
const MAX_PREVIEW_STATUS_CENTER_JOBS = 20;
const STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS = 24 * 60 * 60 * 1000;

export type PreviewStatusCenterJobStatus = PreviewJobPhase;
export type PreviewStatusCenterJob = PreviewJob;
export type PreviewStatusCenterJobInput = PreviewJobUpsertInput;
export type PreviewStatusCenterJobPatch = PreviewJobPatch;

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

type LegacyPendingPreviewState = {
  previewId: string;
  statusToken: string;
  requestKey: string;
  updatedAt: number;
};

type ReadJobsResult = {
  jobs: PreviewStatusCenterJob[];
  migratedFromLegacy: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isJobStatus(value: unknown): value is PreviewStatusCenterJobStatus {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "ready" ||
    value === "failed" ||
    value === "expired"
  );
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
    const [sourceUrl, sourceLang, targetLang, email, ...rest] = encoded.split("|");
    if (!sourceUrl || !sourceLang || !targetLang || rest.length > 0) {
      return null;
    }
    const decodedSourceUrl = decodeRequestKeyPart(sourceUrl);
    const decodedSourceLang = decodeRequestKeyPart(sourceLang);
    const decodedTargetLang = decodeRequestKeyPart(targetLang);
    const decodedEmail = decodeRequestKeyPart(email ?? "");
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

  const [sourceUrl, sourceLang, targetLang, ...rest] = requestKey.split("|");
  if (!sourceUrl || !sourceLang || !targetLang) {
    return null;
  }
  return {
    sourceUrl,
    sourceLang,
    targetLang,
    email: rest.join("|"),
  };
}

function resolveCanonicalRequestKey(
  requestKey: string | null | undefined,
  fallback: {
    sourceUrl: string;
    sourceLang: string;
    targetLang: string;
    email?: string | null;
  },
): string {
  const parsed = requestKey ? parsePreviewStatusCenterRequestKey(requestKey) : null;
  return buildPreviewStatusCenterRequestKey({
    sourceUrl: parsed?.sourceUrl ?? fallback.sourceUrl,
    sourceLang: parsed?.sourceLang ?? fallback.sourceLang,
    targetLang: parsed?.targetLang ?? fallback.targetLang,
    email: parsed?.email ?? fallback.email,
  });
}

function parseOptionalPreviewErrorCode(value: unknown): PreviewErrorCode | null {
  return isPreviewErrorCode(value) ? value : null;
}

function parseOptionalPreviewStage(value: unknown): PreviewStage | null {
  return isPreviewStage(value) ? value : null;
}

function normalizeJob(job: PreviewStatusCenterJob): PreviewStatusCenterJob {
  const terminal = isPreviewStatusCenterJobTerminal(job.status);
  return {
    ...job,
    retryCount: terminal ? 0 : Math.max(0, job.retryCount),
    nextPollAt: terminal
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(job.nextPollAt)
        ? job.nextPollAt
        : Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
    stage: terminal ? null : job.stage,
  };
}

function isActiveStatus(status: PreviewStatusCenterJobStatus): boolean {
  return status === "pending" || status === "processing";
}

function normalizeTimestamp(value: number): number {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
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
  const activeA = isActiveStatus(a.status);
  const activeB = isActiveStatus(b.status);
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

  const previewIdDiff = normalizePreviewId(a.previewId).localeCompare(normalizePreviewId(b.previewId));
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
    !isString(value.statusToken) ||
    !isString(value.sourceUrl) ||
    !isString(value.sourceLang) ||
    !isString(value.targetLang) ||
    !isJobStatus(value.status) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  const status = value.status;
  const requestKey = resolveCanonicalRequestKey(
    isString(value.requestKey) ? value.requestKey : null,
    {
      sourceUrl: value.sourceUrl,
      sourceLang: value.sourceLang,
      targetLang: value.targetLang,
    },
  );
  const stage = parseOptionalPreviewStage(value.stage);
  const errorStage = parseOptionalPreviewStage(value.errorStage);

  return normalizeJob({
    previewId: value.previewId,
    requestKey,
    statusToken: value.statusToken,
    sourceUrl: value.sourceUrl,
    sourceLang: value.sourceLang,
    targetLang: value.targetLang,
    status,
    stage: stage ?? (!isPreviewStatusCenterJobTerminal(status) ? errorStage : null),
    previewUrl: isString(value.previewUrl) ? value.previewUrl : null,
    error: isString(value.error) ? value.error : null,
    errorCode: parseOptionalPreviewErrorCode(value.errorCode),
    errorStage,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: isFiniteNumber(value.expiresAt) ? value.expiresAt : null,
    retryCount: isFiniteNumber(value.retryCount) ? value.retryCount : 0,
    nextPollAt: isFiniteNumber(value.nextPollAt)
      ? value.nextPollAt
      : Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  });
}

function parseStoredLegacyV1Job(value: unknown): PreviewStatusCenterJob | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isString(value.previewId) ||
    !isString(value.statusToken) ||
    !isString(value.sourceUrl) ||
    !isString(value.sourceLang) ||
    !isString(value.targetLang) ||
    !isJobStatus(value.status) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  const status = value.status;
  const legacyStage = parseOptionalPreviewStage(value.errorStage);

  return normalizeJob({
    previewId: value.previewId,
    requestKey: buildPreviewStatusCenterRequestKey({
      sourceUrl: value.sourceUrl,
      sourceLang: value.sourceLang,
      targetLang: value.targetLang,
    }),
    statusToken: value.statusToken,
    sourceUrl: value.sourceUrl,
    sourceLang: value.sourceLang,
    targetLang: value.targetLang,
    status,
    stage: !isPreviewStatusCenterJobTerminal(status) ? legacyStage : null,
    previewUrl: isString(value.previewUrl) ? value.previewUrl : null,
    error: isString(value.error) ? value.error : null,
    errorCode: parseOptionalPreviewErrorCode(value.errorCode),
    errorStage: legacyStage,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: isFiniteNumber(value.expiresAt) ? value.expiresAt : null,
    retryCount: isFiniteNumber(value.retryCount) ? value.retryCount : 0,
    nextPollAt: isFiniteNumber(value.nextPollAt)
      ? value.nextPollAt
      : Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  });
}

function parseLegacyPendingPreview(value: unknown): LegacyPendingPreviewState | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isString(value.previewId) ||
    !isString(value.statusToken) ||
    !isString(value.requestKey) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }
  return {
    previewId: value.previewId,
    statusToken: value.statusToken,
    requestKey: value.requestKey,
    updatedAt: value.updatedAt,
  };
}

function pruneJobs(jobs: PreviewStatusCenterJob[], now = Date.now()): PreviewStatusCenterJob[] {
  return jobs
    .filter((job) => now - job.updatedAt <= STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS)
    .sort(comparePreviewStatusCenterJobs)
    .slice(0, MAX_PREVIEW_STATUS_CENTER_JOBS);
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
  return isJobStatus(entry.status) ? null : entry.status;
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

function migrateLegacyJobsFromStorage(now: number): {
  jobs: PreviewStatusCenterJob[];
  unknownPhaseDrops: number;
} {
  if (!canUseStorage()) {
    return {
      jobs: [],
      unknownPhaseDrops: 0,
    };
  }

  const legacyJobsRaw = window.localStorage.getItem(LEGACY_PREVIEW_STATUS_CENTER_STORAGE_KEY);
  const pendingRaw = window.localStorage.getItem(LEGACY_PENDING_PREVIEW_STORAGE_KEY);

  const jobs: PreviewStatusCenterJob[] = [];
  let unknownPhaseDrops = 0;
  if (legacyJobsRaw) {
    try {
      const parsedLegacy = JSON.parse(legacyJobsRaw) as unknown;
      if (Array.isArray(parsedLegacy)) {
        for (const entry of parsedLegacy) {
          if (resolveUnknownPhase(entry)) {
            unknownPhaseDrops += 1;
          }
          const parsedJob = parseStoredLegacyV1Job(entry);
          if (parsedJob) {
            jobs.push(parsedJob);
          }
        }
      }
    } catch {
      // Ignore malformed legacy payloads.
    }
  }

  let pending: LegacyPendingPreviewState | null = null;
  if (pendingRaw) {
    try {
      pending = parseLegacyPendingPreview(JSON.parse(pendingRaw));
    } catch {
      pending = null;
    }
  }

  if (!pending) {
    return {
      jobs: pruneJobs(jobs, now),
      unknownPhaseDrops,
    };
  }

  const existingIndex = jobs.findIndex((job) => job.previewId === pending.previewId);
  const parsedRequestKey = parsePreviewStatusCenterRequestKey(pending.requestKey);
  const canonicalRequestKey = resolveCanonicalRequestKey(pending.requestKey, {
    sourceUrl: parsedRequestKey?.sourceUrl ?? "",
    sourceLang: parsedRequestKey?.sourceLang ?? "",
    targetLang: parsedRequestKey?.targetLang ?? "",
    email: parsedRequestKey?.email ?? "",
  });

  if (existingIndex >= 0) {
    const existing = jobs[existingIndex];
    const terminal = isPreviewStatusCenterJobTerminal(existing.status);
    jobs[existingIndex] = normalizeJob({
      ...existing,
      requestKey: canonicalRequestKey,
      statusToken: pending.statusToken,
      sourceUrl: parsedRequestKey?.sourceUrl ?? existing.sourceUrl,
      sourceLang: parsedRequestKey?.sourceLang ?? existing.sourceLang,
      targetLang: parsedRequestKey?.targetLang ?? existing.targetLang,
      status: terminal ? existing.status : resolveNextPreviewJobPhase(existing.status, "processing"),
      stage: terminal ? null : existing.stage,
      updatedAt: Math.max(existing.updatedAt, pending.updatedAt),
      nextPollAt: terminal ? Number.POSITIVE_INFINITY : now + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
    });
  } else {
    const status: PreviewStatusCenterJobStatus = "processing";
    jobs.push(
      normalizeJob({
        previewId: pending.previewId,
        requestKey: canonicalRequestKey,
        statusToken: pending.statusToken,
        sourceUrl: parsedRequestKey?.sourceUrl ?? "",
        sourceLang: parsedRequestKey?.sourceLang ?? "",
        targetLang: parsedRequestKey?.targetLang ?? "",
        status,
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: pending.updatedAt,
        updatedAt: pending.updatedAt,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: now + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
      }),
    );
  }

  return {
    jobs: pruneJobs(jobs, now),
    unknownPhaseDrops,
  };
}

function readJobsFromStorage(): ReadJobsResult {
  const v2Result = readV2JobsFromStorage();
  if (v2Result.jobs !== null) {
    return {
      jobs: v2Result.jobs,
      migratedFromLegacy: false,
      unknownPhaseDrops: v2Result.unknownPhaseDrops,
    };
  }
  const migrated = migrateLegacyJobsFromStorage(Date.now());
  return {
    jobs: migrated.jobs,
    migratedFromLegacy: true,
    unknownPhaseDrops: migrated.unknownPhaseDrops,
  };
}

function ensureHydrated() {
  if (hydrated) {
    return;
  }
  hydrated = true;

  const { jobs, migratedFromLegacy, unknownPhaseDrops } = readJobsFromStorage();
  state = {
    jobs,
  };

  if (migratedFromLegacy) {
    persistJobs(state.jobs);
  }
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

  commitJobs(
    state.jobs.map((job, jobIndex) => (jobIndex === index ? normalizeJob(next) : job)),
  );
}

export function hydratePreviewStatusCenterStore() {
  const wasHydrated = hydrated;
  ensureHydrated();
  if (!wasHydrated) {
    emit();
  }
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

export function selectJobsForStatusCenter(
  jobs: PreviewStatusCenterJob[] = state.jobs,
): PreviewStatusCenterJob[] {
  return jobs;
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

export function updatePreviewStatusCenterJob(previewId: string, patch: PreviewStatusCenterJobPatch) {
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

export function setPreviewStatusCenterJobRetry(previewId: string, retryCount: number, delayMs: number) {
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
