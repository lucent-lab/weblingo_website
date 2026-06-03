import type { PreviewJobKind } from "./preview-job-machine";
import { isPreviewStage, type PreviewStage } from "./preview-sse";

export function buildPreviewJobStatusUrl(
  kind: PreviewJobKind,
  previewId: string,
  statusToken: string,
): string {
  const token = encodeURIComponent(statusToken);
  if (kind === "prospect_showcase") {
    return `/api/prospect-showcases/${encodeURIComponent(previewId)}/status?token=${token}`;
  }
  return `/api/previews/${previewId}?token=${token}`;
}

export function buildPreviewJobStreamUrl(
  kind: PreviewJobKind,
  previewId: string,
  statusToken: string,
): string {
  const token = encodeURIComponent(statusToken);
  if (kind === "prospect_showcase") {
    return `/api/prospect-showcases/${encodeURIComponent(previewId)}/stream?token=${token}`;
  }
  return `/api/previews/${previewId}/stream?token=${token}`;
}

export function resolvePreviewJobPayloadUrl(
  kind: PreviewJobKind,
  payload: Record<string, unknown> | null,
): string | null {
  if (kind === "prospect_showcase") {
    return typeof payload?.showcaseUrl === "string" ? payload.showcaseUrl : null;
  }
  return typeof payload?.previewUrl === "string" ? payload.previewUrl : null;
}

export function resolvePreviewJobPayloadDemoDashboardUrl(
  payload: Record<string, unknown> | null,
): string | null {
  return typeof payload?.demoDashboardUrl === "string" ? payload.demoDashboardUrl : null;
}

export function resolvePreviewJobPayloadExpiresAt(
  payload: Record<string, unknown> | null,
): number | null {
  const raw = payload?.expiresAt;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolvePreviewJobPayloadStage(value: unknown): PreviewStage | null {
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
