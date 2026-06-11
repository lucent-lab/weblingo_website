import type { PreviewErrorCode, PreviewStage } from "./preview-sse";

export type PreviewJobPhase =
  | "pending"
  | "processing"
  | "waiting_provider_capacity"
  | "ready"
  | "failed"
  | "expired";

export type PreviewRetryHintReason = "browser_capacity_exhausted" | "provider_capacity_wait";

export type PreviewRetryHint = {
  reason: PreviewRetryHintReason;
  retryAfterSeconds: number | null;
};

export type PreviewJob = {
  previewId: string;
  requestKey: string;
  statusToken: string;
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  status: PreviewJobPhase;
  stage: PreviewStage | null;
  previewUrl: string | null;
  demoDashboardUrl?: string | null;
  error: string | null;
  errorCode: PreviewErrorCode | null;
  errorStage: PreviewStage | null;
  retryHint: PreviewRetryHint | null;
  remoteStatusVerified: boolean;
  /** Last time the backend confirmed this job's status; null when never verified. */
  lastVerifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  retryCount: number;
  nextPollAt: number;
};

export type PreviewJobUpsertInput = {
  previewId: string;
  requestKey: string;
  statusToken: string;
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  status: PreviewJobPhase;
  stage?: PreviewStage | null;
  previewUrl?: string | null;
  demoDashboardUrl?: string | null;
  error?: string | null;
  errorCode?: PreviewErrorCode | null;
  errorStage?: PreviewStage | null;
  retryHint?: PreviewRetryHint | null;
  remoteStatusVerified?: boolean;
  expiresAt?: number | null;
  retryCount?: number;
  nextPollAt?: number;
};

export type PreviewJobPatch = Partial<{
  requestKey: string;
  statusToken: string;
  sourceUrl: string;
  sourceLang: string;
  targetLang: string;
  status: PreviewJobPhase;
  stage: PreviewStage | null;
  previewUrl: string | null;
  demoDashboardUrl: string | null;
  error: string | null;
  errorCode: PreviewErrorCode | null;
  errorStage: PreviewStage | null;
  retryHint: PreviewRetryHint | null;
  remoteStatusVerified: boolean;
  expiresAt: number | null;
  retryCount: number;
  nextPollAt: number;
}>;

export type PreviewJobEvent =
  | {
      type: "upsert";
      input: PreviewJobUpsertInput;
    }
  | {
      type: "patch";
      patch: PreviewJobPatch;
    }
  | {
      type: "terminal";
      status: Extract<PreviewJobPhase, "ready" | "failed" | "expired">;
      patch?: Omit<PreviewJobPatch, "status">;
    }
  | {
      type: "set_retry";
      retryCount: number;
      nextPollAt: number;
    }
  | {
      type: "reset_retry";
      nextPollAt: number;
    };

type ReducePreviewJobContext = {
  now: number;
  defaultPollIntervalMs: number;
};

export type ActivePreviewJobPhase = Extract<
  PreviewJobPhase,
  "pending" | "processing" | "waiting_provider_capacity"
>;

const ACTIVE_PHASE_ORDER: Record<ActivePreviewJobPhase, number> = {
  pending: 1,
  processing: 2,
  waiting_provider_capacity: 3,
};

const STAGE_ORDER: Record<PreviewStage, number> = {
  fetching_page: 1,
  analyzing_content: 2,
  translating: 3,
  generating_preview: 4,
  saving: 5,
};

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parsePreviewRetryHint(value: unknown): PreviewRetryHint | null {
  if (!isRecord(value) || !isPreviewCapacityRetryHintReason(value.reason)) {
    return null;
  }
  const retryAfterSeconds =
    typeof value.retryAfterSeconds === "number" &&
    Number.isFinite(value.retryAfterSeconds) &&
    Number.isInteger(value.retryAfterSeconds) &&
    value.retryAfterSeconds >= 0
      ? value.retryAfterSeconds
      : null;
  return {
    reason: value.reason,
    retryAfterSeconds,
  };
}

export function isPreviewCapacityRetryHintReason(value: unknown): value is PreviewRetryHintReason {
  return value === "browser_capacity_exhausted" || value === "provider_capacity_wait";
}

export function isPreviewJobPhase(value: unknown): value is PreviewJobPhase {
  return (
    value === "pending" ||
    value === "processing" ||
    value === "waiting_provider_capacity" ||
    value === "ready" ||
    value === "failed" ||
    value === "expired"
  );
}

function resolveStringWithFallback(patchValue: string | undefined, currentValue: string): string {
  return isNonEmptyString(patchValue) ? patchValue : currentValue;
}

export function resolvePreviewRetryHintDelayMs(
  retryHint: PreviewRetryHint | null | undefined,
): number | null {
  if (!retryHint || retryHint.retryAfterSeconds === null) {
    return null;
  }
  return Math.max(0, retryHint.retryAfterSeconds * 1000);
}

function resolveNextPollAt(
  currentValue: number | undefined,
  patchValue: number | undefined,
  terminal: boolean,
  now: number,
  defaultPollIntervalMs: number,
  retryHint?: PreviewRetryHint | null,
): number {
  if (patchValue !== undefined) {
    return patchValue;
  }
  if (terminal) {
    return Number.POSITIVE_INFINITY;
  }
  if (currentValue !== undefined) {
    return currentValue;
  }
  const retryHintDelayMs = resolvePreviewRetryHintDelayMs(retryHint);
  if (retryHintDelayMs !== null) {
    return now + retryHintDelayMs;
  }
  return now + defaultPollIntervalMs;
}

export function isPreviewJobTerminal(status: PreviewJobPhase): boolean {
  return status === "ready" || status === "failed" || status === "expired";
}

export function isActivePreviewJobPhase(status: unknown): status is ActivePreviewJobPhase {
  return status === "pending" || status === "processing" || status === "waiting_provider_capacity";
}

export function resolveNextPreviewJobPhase(
  current: PreviewJobPhase | null,
  incoming: PreviewJobPhase,
): PreviewJobPhase {
  if (!current) {
    return incoming;
  }
  if (isPreviewJobTerminal(current)) {
    return current;
  }
  if (isPreviewJobTerminal(incoming)) {
    return incoming;
  }
  if (!isActivePreviewJobPhase(current) || !isActivePreviewJobPhase(incoming)) {
    return current;
  }
  if (current === "waiting_provider_capacity" && incoming === "processing") {
    return incoming;
  }
  return ACTIVE_PHASE_ORDER[incoming] >= ACTIVE_PHASE_ORDER[current] ? incoming : current;
}

export function resolveNextPreviewJobStage(
  current: PreviewStage | null,
  incoming: PreviewStage | null | undefined,
): PreviewStage | null {
  if (incoming === undefined) {
    return current;
  }
  if (incoming === null) {
    return null;
  }
  if (current === null) {
    return incoming;
  }
  return STAGE_ORDER[incoming] >= STAGE_ORDER[current] ? incoming : current;
}

function reduceUpsert(
  existing: PreviewJob | null,
  input: PreviewJobUpsertInput,
  context: ReducePreviewJobContext,
): PreviewJob {
  const status = resolveNextPreviewJobPhase(existing?.status ?? null, input.status);
  const terminal = isPreviewJobTerminal(status);
  const stage = terminal
    ? null
    : resolveNextPreviewJobStage(existing?.stage ?? null, input.stage ?? undefined);
  const retryHint = terminal
    ? null
    : input.retryHint === undefined
      ? (existing?.retryHint ?? null)
      : input.retryHint;
  const remoteStatusVerified = terminal
    ? true
    : (input.remoteStatusVerified ?? existing?.remoteStatusVerified ?? true);

  return {
    previewId: input.previewId,
    requestKey: resolveStringWithFallback(input.requestKey, existing?.requestKey ?? ""),
    statusToken: resolveStringWithFallback(input.statusToken, existing?.statusToken ?? ""),
    sourceUrl: resolveStringWithFallback(input.sourceUrl, existing?.sourceUrl ?? ""),
    sourceLang: resolveStringWithFallback(input.sourceLang, existing?.sourceLang ?? ""),
    targetLang: resolveStringWithFallback(input.targetLang, existing?.targetLang ?? ""),
    status,
    stage,
    previewUrl: input.previewUrl ?? existing?.previewUrl ?? null,
    demoDashboardUrl: input.demoDashboardUrl ?? existing?.demoDashboardUrl ?? null,
    error: input.error ?? existing?.error ?? null,
    errorCode: input.errorCode ?? existing?.errorCode ?? null,
    errorStage: input.errorStage ?? existing?.errorStage ?? null,
    retryHint,
    remoteStatusVerified,
    lastVerifiedAt: remoteStatusVerified ? context.now : (existing?.lastVerifiedAt ?? null),
    createdAt: existing?.createdAt ?? context.now,
    updatedAt: context.now,
    expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
    retryCount: terminal ? 0 : Math.max(0, input.retryCount ?? existing?.retryCount ?? 0),
    nextPollAt: resolveNextPollAt(
      existing?.nextPollAt,
      input.nextPollAt,
      terminal,
      context.now,
      context.defaultPollIntervalMs,
      retryHint,
    ),
  };
}

function reducePatch(
  existing: PreviewJob,
  patch: PreviewJobPatch,
  context: ReducePreviewJobContext,
): PreviewJob {
  const status =
    patch.status === undefined
      ? existing.status
      : resolveNextPreviewJobPhase(existing.status, patch.status);
  const terminal = isPreviewJobTerminal(status);
  const stage = terminal
    ? null
    : resolveNextPreviewJobStage(existing.stage, patch.stage ?? undefined);
  const retryHint = terminal
    ? null
    : patch.retryHint === undefined
      ? existing.retryHint
      : patch.retryHint;
  const remoteStatusVerified = terminal
    ? true
    : (patch.remoteStatusVerified ?? existing.remoteStatusVerified);

  return {
    ...existing,
    requestKey: resolveStringWithFallback(patch.requestKey, existing.requestKey),
    statusToken: resolveStringWithFallback(patch.statusToken, existing.statusToken),
    sourceUrl: resolveStringWithFallback(patch.sourceUrl, existing.sourceUrl),
    sourceLang: resolveStringWithFallback(patch.sourceLang, existing.sourceLang),
    targetLang: resolveStringWithFallback(patch.targetLang, existing.targetLang),
    status,
    stage,
    previewUrl: patch.previewUrl === undefined ? existing.previewUrl : patch.previewUrl,
    demoDashboardUrl:
      patch.demoDashboardUrl === undefined ? existing.demoDashboardUrl : patch.demoDashboardUrl,
    error: patch.error === undefined ? existing.error : patch.error,
    errorCode: patch.errorCode === undefined ? existing.errorCode : patch.errorCode,
    errorStage: patch.errorStage === undefined ? existing.errorStage : patch.errorStage,
    retryHint,
    remoteStatusVerified,
    lastVerifiedAt: remoteStatusVerified ? context.now : existing.lastVerifiedAt,
    expiresAt: patch.expiresAt === undefined ? existing.expiresAt : patch.expiresAt,
    updatedAt: context.now,
    retryCount: terminal
      ? 0
      : Math.max(0, patch.retryCount === undefined ? existing.retryCount : patch.retryCount),
    nextPollAt: resolveNextPollAt(
      existing.nextPollAt,
      patch.nextPollAt,
      terminal,
      context.now,
      context.defaultPollIntervalMs,
      retryHint,
    ),
  };
}

export function reducePreviewJob(
  existing: PreviewJob | null,
  event: PreviewJobEvent,
  context: ReducePreviewJobContext,
): PreviewJob | null {
  if (event.type === "upsert") {
    return reduceUpsert(existing, event.input, context);
  }
  if (!existing) {
    return null;
  }
  if (event.type === "patch") {
    return reducePatch(existing, event.patch, context);
  }
  if (event.type === "terminal") {
    return reducePatch(
      existing,
      {
        ...(event.patch ?? {}),
        status: event.status,
        retryCount: 0,
        nextPollAt: Number.POSITIVE_INFINITY,
        stage: null,
        remoteStatusVerified: true,
      },
      context,
    );
  }
  if (event.type === "set_retry") {
    return reducePatch(
      existing,
      {
        retryCount: Math.max(0, event.retryCount),
        nextPollAt: event.nextPollAt,
      },
      context,
    );
  }
  return reducePatch(
    existing,
    {
      retryCount: 0,
      nextPollAt: event.nextPollAt,
    },
    context,
  );
}
