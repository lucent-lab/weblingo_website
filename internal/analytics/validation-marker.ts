export const QA_MARKER_QUERY_PARAM = "qa_marker";
export const QA_MARKER_COOKIE_NAME = "weblingo_qa_marker";
export const QA_MARKER_HEADER_NAME = "x-validation-marker";
export const QA_MARKER_MAX_AGE_SECONDS = 60 * 60 * 4;

const VALIDATION_MARKER_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

export function normalizeValidationMarker(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return VALIDATION_MARKER_PATTERN.test(trimmed) ? trimmed : null;
}

export function buildQaMarkerCookieValue(marker: string): string {
  return [
    `${QA_MARKER_COOKIE_NAME}=${encodeURIComponent(marker)}`,
    "Path=/",
    `Max-Age=${QA_MARKER_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

export function buildQaMarkerDeleteCookieValue(): string {
  return [`${QA_MARKER_COOKIE_NAME}=`, "Path=/", "Max-Age=0", "SameSite=Lax", "Secure"].join("; ");
}
