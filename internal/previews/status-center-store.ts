import type { PreviewErrorCode, PreviewStage } from "./preview-sse";

export const PREVIEW_STATUS_CENTER_STORAGE_KEY = "weblingo:preview-status-center:v1";
export const DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS = 5_000;
const MAX_PREVIEW_STATUS_CENTER_JOBS = 20;
const STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS = 24 * 60 * 60 * 1000;

export type PreviewStatusCenterJobStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "expired";

export type PreviewStatusCenterJob = {
  previewId: string;
  statusToken: string;
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  status: PreviewStatusCenterJobStatus;
  previewUrl: string | null;
  error: string | null;
  errorCode: PreviewErrorCode | null;
  errorStage: PreviewStage | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  retryCount: number;
  nextPollAt: number;
};

export type PreviewStatusCenterState = {
  jobs: PreviewStatusCenterJob[];
};

type PreviewStatusCenterJobInput = {
  previewId: string;
  statusToken: string;
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  status: PreviewStatusCenterJobStatus;
  previewUrl?: string | null;
  error?: string | null;
  errorCode?: PreviewErrorCode | null;
  errorStage?: PreviewStage | null;
  expiresAt?: number | null;
  retryCount?: number;
  nextPollAt?: number;
};

type PreviewStatusCenterJobPatch = Partial<
  Omit<PreviewStatusCenterJobInput, "previewId" | "statusToken" | "sourceUrl" | "sourceLang" | "targetLang">
> & {
  status?: PreviewStatusCenterJobStatus;
};

type Listener = () => void;

const listeners = new Set<Listener>();
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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

function normalizeJob(job: PreviewStatusCenterJob): PreviewStatusCenterJob {
  const terminal = isPreviewStatusCenterJobTerminal(job.status);
  return {
    ...job,
    retryCount: terminal ? 0 : Math.max(0, job.retryCount),
    nextPollAt: terminal ? Number.POSITIVE_INFINITY : job.nextPollAt,
  };
}

function parseStoredJob(value: unknown): PreviewStatusCenterJob | null {
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

  const previewUrl = isString(value.previewUrl) ? value.previewUrl : null;
  const error = isString(value.error) ? value.error : null;
  const errorCode = isString(value.errorCode) ? (value.errorCode as PreviewErrorCode) : null;
  const errorStage = isString(value.errorStage) ? (value.errorStage as PreviewStage) : null;
  const expiresAt = isFiniteNumber(value.expiresAt) ? value.expiresAt : null;
  const retryCount = isFiniteNumber(value.retryCount) ? value.retryCount : 0;
  const nextPollAt = isFiniteNumber(value.nextPollAt)
    ? value.nextPollAt
    : Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS;

  return normalizeJob({
    previewId: value.previewId,
    statusToken: value.statusToken,
    sourceUrl: value.sourceUrl,
    sourceLang: value.sourceLang,
    targetLang: value.targetLang,
    status: value.status,
    previewUrl,
    error,
    errorCode,
    errorStage,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt,
    retryCount,
    nextPollAt,
  });
}

function isPreviewStatusCenterJobValue(value: PreviewStatusCenterJob | null): value is PreviewStatusCenterJob {
  return value !== null;
}

function pruneJobs(jobs: PreviewStatusCenterJob[], now = Date.now()): PreviewStatusCenterJob[] {
  return jobs
    .filter((job) => now - job.updatedAt <= STALE_PREVIEW_STATUS_CENTER_JOB_TTL_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PREVIEW_STATUS_CENTER_JOBS);
}

function persistJobs(jobs: PreviewStatusCenterJob[]) {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(PREVIEW_STATUS_CENTER_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Ignore localStorage failures.
  }
}

function replaceJobs(nextJobs: PreviewStatusCenterJob[]) {
  state = {
    jobs: pruneJobs(nextJobs),
  };
  persistJobs(state.jobs);
  emit();
}

function readJobsFromStorage(): PreviewStatusCenterJob[] {
  if (!canUseStorage()) {
    return [];
  }
  const raw = window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return pruneJobs(parsed.map((entry) => parseStoredJob(entry)).filter(isPreviewStatusCenterJobValue));
  } catch {
    return [];
  }
}

function ensureHydrated() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  state = {
    jobs: readJobsFromStorage(),
  };
}

function updateJob(
  previewId: string,
  updater: (existing: PreviewStatusCenterJob) => PreviewStatusCenterJob,
) {
  ensureHydrated();
  const current = state.jobs.find((job) => job.previewId === previewId);
  if (!current) {
    return;
  }
  const next = updater(current);
  replaceJobs(state.jobs.map((job) => (job.previewId === previewId ? normalizeJob(next) : job)));
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
  return { jobs: [] };
}

export function isPreviewStatusCenterJobTerminal(status: PreviewStatusCenterJobStatus): boolean {
  return status === "ready" || status === "failed" || status === "expired";
}

export function isPreviewStatusCenterJobActive(job: PreviewStatusCenterJob): boolean {
  return !isPreviewStatusCenterJobTerminal(job.status);
}

export function upsertPreviewStatusCenterJob(input: PreviewStatusCenterJobInput) {
  ensureHydrated();
  const now = Date.now();
  const existing = state.jobs.find((job) => job.previewId === input.previewId);
  const terminal = isPreviewStatusCenterJobTerminal(input.status);

  const next: PreviewStatusCenterJob = normalizeJob({
    previewId: input.previewId,
    statusToken: input.statusToken,
    sourceUrl: input.sourceUrl,
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    status: input.status,
    previewUrl: input.previewUrl ?? existing?.previewUrl ?? null,
    error: input.error ?? existing?.error ?? null,
    errorCode: input.errorCode ?? existing?.errorCode ?? null,
    errorStage: input.errorStage ?? existing?.errorStage ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    retryCount: terminal ? 0 : (input.retryCount ?? existing?.retryCount ?? 0),
    nextPollAt:
      input.nextPollAt ??
      (terminal ? Number.POSITIVE_INFINITY : now + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS),
  });

  if (existing) {
    replaceJobs(state.jobs.map((job) => (job.previewId === input.previewId ? next : job)));
    return;
  }
  replaceJobs([next, ...state.jobs]);
}

export function updatePreviewStatusCenterJob(previewId: string, patch: PreviewStatusCenterJobPatch) {
  updateJob(previewId, (existing) => {
    const terminal = patch.status ? isPreviewStatusCenterJobTerminal(patch.status) : false;
    return {
      ...existing,
      status: patch.status ?? existing.status,
      previewUrl: patch.previewUrl === undefined ? existing.previewUrl : patch.previewUrl,
      error: patch.error === undefined ? existing.error : patch.error,
      errorCode: patch.errorCode === undefined ? existing.errorCode : patch.errorCode,
      errorStage: patch.errorStage === undefined ? existing.errorStage : patch.errorStage,
      expiresAt: patch.expiresAt === undefined ? existing.expiresAt : patch.expiresAt,
      updatedAt: Date.now(),
      retryCount: patch.retryCount ?? (terminal ? 0 : existing.retryCount),
      nextPollAt:
        patch.nextPollAt ??
        (terminal ? Number.POSITIVE_INFINITY : existing.nextPollAt),
    };
  });
}

export function markPreviewStatusCenterJobTerminal(
  previewId: string,
  status: Extract<PreviewStatusCenterJobStatus, "ready" | "failed" | "expired">,
  patch: Omit<PreviewStatusCenterJobPatch, "status"> = {},
) {
  updatePreviewStatusCenterJob(previewId, {
    ...patch,
    status,
    retryCount: 0,
    nextPollAt: Number.POSITIVE_INFINITY,
  });
}

export function removePreviewStatusCenterJob(previewId: string) {
  ensureHydrated();
  replaceJobs(state.jobs.filter((job) => job.previewId !== previewId));
}

export function setPreviewStatusCenterJobRetry(previewId: string, retryCount: number, delayMs: number) {
  updatePreviewStatusCenterJob(previewId, {
    retryCount,
    nextPollAt: Date.now() + Math.max(0, delayMs),
  });
}

export function resetPreviewStatusCenterJobRetry(previewId: string) {
  updatePreviewStatusCenterJob(previewId, {
    retryCount: 0,
    nextPollAt: Date.now() + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  });
}

export function calculatePreviewStatusCenterRetryDelayMs(retryCount: number): number {
  const cappedRetries = Math.max(0, retryCount);
  const delay = DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS * 2 ** cappedRetries;
  return Math.min(delay, 60_000);
}

export function cleanupPreviewStatusCenterJobs() {
  ensureHydrated();
  replaceJobs(state.jobs);
}

export function resetPreviewStatusCenterStoreForTests() {
  hydrated = false;
  state = { jobs: [] };
  listeners.clear();
}
