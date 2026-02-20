import type { PreviewErrorCode, PreviewStage } from "./preview-sse";

export type PreviewJobPhase = "pending" | "processing" | "ready" | "failed" | "expired";

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
  error: string | null;
  errorCode: PreviewErrorCode | null;
  errorStage: PreviewStage | null;
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
  error?: string | null;
  errorCode?: PreviewErrorCode | null;
  errorStage?: PreviewStage | null;
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
  error: string | null;
  errorCode: PreviewErrorCode | null;
  errorStage: PreviewStage | null;
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

type ActivePreviewJobPhase = Extract<PreviewJobPhase, "pending" | "processing">;

const ACTIVE_PHASE_ORDER: Record<ActivePreviewJobPhase, number> = {
  pending: 1,
  processing: 2,
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

function resolveStringWithFallback(patchValue: string | undefined, currentValue: string): string {
  return isNonEmptyString(patchValue) ? patchValue : currentValue;
}

function resolveNextPollAt(
  currentValue: number | undefined,
  patchValue: number | undefined,
  terminal: boolean,
  now: number,
  defaultPollIntervalMs: number,
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
  return now + defaultPollIntervalMs;
}

export function isPreviewJobTerminal(status: PreviewJobPhase): boolean {
  return status === "ready" || status === "failed" || status === "expired";
}

function isActivePreviewJobPhase(status: PreviewJobPhase): status is ActivePreviewJobPhase {
  return status === "pending" || status === "processing";
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
    error: input.error ?? existing?.error ?? null,
    errorCode: input.errorCode ?? existing?.errorCode ?? null,
    errorStage: input.errorStage ?? existing?.errorStage ?? null,
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
    ),
  };
}

function reducePatch(existing: PreviewJob, patch: PreviewJobPatch, context: ReducePreviewJobContext): PreviewJob {
  const status =
    patch.status === undefined
      ? existing.status
      : resolveNextPreviewJobPhase(existing.status, patch.status);
  const terminal = isPreviewJobTerminal(status);
  const stage = terminal
    ? null
    : resolveNextPreviewJobStage(existing.stage, patch.stage ?? undefined);

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
    error: patch.error === undefined ? existing.error : patch.error,
    errorCode: patch.errorCode === undefined ? existing.errorCode : patch.errorCode,
    errorStage: patch.errorStage === undefined ? existing.errorStage : patch.errorStage,
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
