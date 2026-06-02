import {
  isActivePreviewJobPhase,
  parsePreviewRetryHint,
  type ActivePreviewJobPhase,
  type PreviewJobKind,
  type PreviewRetryHint,
} from "./preview-job-machine";
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
      retryHint: PreviewRetryHint | null;
      remoteStatusVerified: boolean;
    }
  | {
      kind: "terminal";
      status: "ready" | "failed" | "expired";
      previewUrl?: string | null;
      demoDashboardUrl?: string | null;
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

function readDetails(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  return payload && typeof payload.details === "object" && payload.details !== null
    ? (payload.details as Record<string, unknown>)
    : null;
}

function resolvePayloadPreviewUrl(
  payload: Record<string, unknown>,
  payloadKind: PreviewJobKind,
): string | null {
  if (payloadKind === "preview" && typeof payload.previewUrl === "string") {
    return payload.previewUrl;
  }
  if (payloadKind === "prospect_showcase" && typeof payload.showcaseUrl === "string") {
    return payload.showcaseUrl;
  }
  return null;
}

function resolvePayloadStage(value: unknown): PreviewStage | null {
  if (isPreviewStage(value)) {
    return value;
  }
  if (value === "accepted" || value === "queued" || value === "validating") {
    return "fetching_page";
  }
  if (value === "creating_demo" || value === "crawling_source") {
    return "analyzing_content";
  }
  if (value === "translating") {
    return "translating";
  }
  if (value === "building_showcase") {
    return "generating_preview";
  }
  return null;
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
        error: null,
        errorCode: "preview_expired",
        errorStage: null,
      };
    }

    if (responseStatus === 404 && mapNotFoundToErrorCode) {
      return {
        kind: "terminal",
        status: "failed",
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

  if (payload.status === "ready") {
    return {
      kind: "terminal",
      status: "ready",
      previewUrl: resolvePayloadPreviewUrl(payload, payloadKind),
      demoDashboardUrl:
        typeof payload.demoDashboardUrl === "string" ? payload.demoDashboardUrl : null,
      error: null,
      errorCode: null,
      errorStage: null,
    };
  }

  if (payload.status === "failed" || hasExplicitFailure(payload)) {
    const resolved = resolvePreviewErrorPayload(payload, defaultErrorMessage, resolveErrorMessage);
    return {
      kind: "terminal",
      status: resolved.code === "preview_expired" ? "expired" : "failed",
      error: resolved.message,
      errorCode: resolved.code,
      errorStage: resolved.stage,
    };
  }

  return {
    kind: "active",
    status: isActivePreviewJobPhase(payload.status) ? payload.status : "processing",
    stage: resolvePayloadStage(payload.stage),
    previewUrl: resolvePayloadPreviewUrl(payload, payloadKind) ?? undefined,
    retryHint: parsePreviewRetryHint(payload.retryHint),
    remoteStatusVerified: true,
  };
}
