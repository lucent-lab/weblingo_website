import {
  isActivePreviewJobPhase,
  parsePreviewRetryHint,
  type ActivePreviewJobPhase,
  type PreviewJobKind,
  type PreviewRetryHint,
} from "./preview-job-machine";
import {
  resolvePreviewJobPayloadDemoDashboardUrl,
  resolvePreviewJobPayloadExpiresAt,
  resolvePreviewJobPayloadStage,
  resolvePreviewJobPayloadUrl,
} from "./preview-job-policy";
import {
  hasExplicitFailure,
  isPreviewErrorCode,
  isPreviewStage,
  resolveStatusCheckFailure,
  type PreviewErrorCode,
  type PreviewStage,
} from "./preview-sse";

export type ResolvedPreviewStatusError = {
  code: PreviewErrorCode | null;
  stage: PreviewStage | null;
  message: string;
};

export type PreviewStatusDecision =
  | {
      kind: "active";
      status: ActivePreviewJobPhase;
      stage: PreviewStage | null;
      previewUrl?: string;
      expiresAt?: number | null;
      retryHint: PreviewRetryHint | null;
      remoteStatusVerified: boolean;
    }
  | {
      kind: "terminal";
      status: "ready" | "failed" | "expired";
      previewUrl?: string | null;
      demoDashboardUrl?: string | null;
      expiresAt?: number | null;
      error?: string | null;
      errorCode?: PreviewErrorCode | null;
      errorStage?: PreviewStage | null;
    };

export type PreviewErrorMessageResolver = (
  code: PreviewErrorCode | null,
  fallback?: string | null,
) => string;

type ResolvePreviewStatusDecisionInput = {
  responseOk: boolean;
  responseStatus: number;
  payload: Record<string, unknown> | null;
  defaultErrorMessage: string;
  resolveErrorMessage?: PreviewErrorMessageResolver;
  mapNotFoundToErrorCode?: boolean;
  payloadKind?: PreviewJobKind;
};

type PayloadLocationPatch = {
  previewUrl?: string | null;
  demoDashboardUrl?: string | null;
  expiresAt?: number;
};

const PROSPECT_SHOWCASE_READY_TERMINAL_STATUSES = new Set([
  "checkout_pending",
  "activation_pending",
  "converted",
]);

function readDetails(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  return payload && typeof payload.details === "object" && payload.details !== null
    ? (payload.details as Record<string, unknown>)
    : null;
}

function isProspectShowcaseTerminalStatus(payloadKind: PreviewJobKind, status: unknown): boolean {
  return (
    payloadKind === "prospect_showcase" &&
    typeof status === "string" &&
    PROSPECT_SHOWCASE_READY_TERMINAL_STATUSES.has(status)
  );
}

function readPayloadMessage(payload: Record<string, unknown> | null): string | null {
  return typeof payload?.message === "string" ? payload.message : null;
}

function buildPayloadLocationPatch(
  payloadKind: PreviewJobKind,
  payload: Record<string, unknown> | null,
  options: { clearMissingLinks?: boolean } = {},
): PayloadLocationPatch {
  const previewUrl = resolvePreviewJobPayloadUrl(payloadKind, payload);
  const demoDashboardUrl = resolvePreviewJobPayloadDemoDashboardUrl(payload);
  const expiresAt = resolvePreviewJobPayloadExpiresAt(payload);
  return {
    ...(previewUrl === null
      ? options.clearMissingLinks === true
        ? { previewUrl: null }
        : {}
      : { previewUrl }),
    ...(demoDashboardUrl === null
      ? options.clearMissingLinks === true
        ? { demoDashboardUrl: null }
        : {}
      : { demoDashboardUrl }),
    ...(expiresAt === null ? {} : { expiresAt }),
  };
}

export function resolvePreviewErrorPayload(
  payload: Record<string, unknown> | null,
  fallback: string,
  resolveErrorMessage?: PreviewErrorMessageResolver,
): ResolvedPreviewStatusError {
  const details = readDetails(payload);
  const code = isPreviewErrorCode(payload?.errorCode)
    ? payload.errorCode
    : details && isPreviewErrorCode(details.errorCode)
      ? details.errorCode
      : null;
  const stage = isPreviewStage(payload?.errorStage)
    ? payload.errorStage
    : details && isPreviewStage(details.errorStage)
      ? details.errorStage
      : null;
  const rawMessage =
    (payload?.error as string | undefined) || (payload?.message as string | undefined) || fallback;

  return {
    code,
    stage,
    message: resolveErrorMessage ? resolveErrorMessage(code, rawMessage) : rawMessage,
  };
}

export function resolvePreviewStatusDecision({
  responseOk,
  responseStatus,
  payload,
  defaultErrorMessage,
  resolveErrorMessage,
  mapNotFoundToErrorCode = false,
  payloadKind = "preview",
}: ResolvePreviewStatusDecisionInput): PreviewStatusDecision {
  if (!responseOk) {
    if (responseStatus === 410) {
      return {
        kind: "terminal",
        status: "expired",
        previewUrl: null,
        ...(payloadKind === "prospect_showcase" ? {} : { demoDashboardUrl: null }),
        error: null,
        errorCode: "preview_expired",
        errorStage: null,
      };
    }

    if (responseStatus === 404 && mapNotFoundToErrorCode) {
      return {
        kind: "terminal",
        status: "failed",
        previewUrl: null,
        demoDashboardUrl: null,
        error: null,
        errorCode: "preview_not_found",
        errorStage: null,
      };
    }

    const decision = resolveStatusCheckFailure(responseStatus, payload);
    if (decision === "processing") {
      return {
        kind: "active",
        status: "processing",
        stage: null,
        retryHint: null,
        remoteStatusVerified: false,
      };
    }

    const resolved = resolvePreviewErrorPayload(payload, defaultErrorMessage, resolveErrorMessage);
    return {
      kind: "terminal",
      status: resolved.code === "preview_expired" ? "expired" : "failed",
      previewUrl: null,
      demoDashboardUrl: null,
      error: resolved.message,
      errorCode: resolved.code,
      errorStage: resolved.stage,
    };
  }

  if (!payload) {
    return {
      kind: "active",
      status: "processing",
      stage: null,
      retryHint: null,
      remoteStatusVerified: false,
    };
  }

  if (payloadKind === "prospect_showcase" && payload.status === "payment_failed") {
    const resolved = resolvePreviewErrorPayload(payload, defaultErrorMessage, resolveErrorMessage);
    return {
      kind: "terminal",
      status: "failed",
      ...buildPayloadLocationPatch(payloadKind, payload, { clearMissingLinks: true }),
      error: resolved.message,
      errorCode: resolved.code,
      errorStage: resolved.stage,
    };
  }

  const isProspectShowcaseTerminal = isProspectShowcaseTerminalStatus(payloadKind, payload.status);
  if (payload.status === "ready" || isProspectShowcaseTerminal) {
    return {
      kind: "terminal",
      status: "ready",
      ...buildPayloadLocationPatch(payloadKind, payload),
      error: isProspectShowcaseTerminal ? readPayloadMessage(payload) : null,
      errorCode: null,
      errorStage: null,
    };
  }

  if (payload.status === "failed" || hasExplicitFailure(payload)) {
    const resolved = resolvePreviewErrorPayload(payload, defaultErrorMessage, resolveErrorMessage);
    return {
      kind: "terminal",
      status: resolved.code === "preview_expired" ? "expired" : "failed",
      ...buildPayloadLocationPatch(payloadKind, payload, { clearMissingLinks: true }),
      error: resolved.message,
      errorCode: resolved.code,
      errorStage: resolved.stage,
    };
  }

  const expiresAt = resolvePreviewJobPayloadExpiresAt(payload);
  return {
    kind: "active",
    status: isActivePreviewJobPhase(payload.status) ? payload.status : "processing",
    stage: resolvePreviewJobPayloadStage(payload.stage),
    previewUrl: resolvePreviewJobPayloadUrl(payloadKind, payload) ?? undefined,
    ...(expiresAt === null ? {} : { expiresAt }),
    retryHint: parsePreviewRetryHint(payload.retryHint),
    remoteStatusVerified: true,
  };
}
