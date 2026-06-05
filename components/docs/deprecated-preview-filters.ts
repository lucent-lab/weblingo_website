export const DEPRECATED_PREVIEW_OPERATION_IDS = [
  "previews.create",
  "previews.feedback",
  "previews.status",
  "previews.updateEmail",
];

export const DEPRECATED_PREVIEW_SURFACE_PATHS = ["/_preview/{previewId}"];

const DEPRECATED_PREVIEW_OPERATION_ID_SET = new Set(DEPRECATED_PREVIEW_OPERATION_IDS);
const DEPRECATED_PREVIEW_SURFACE_PATH_SET = new Set(DEPRECATED_PREVIEW_SURFACE_PATHS);

export function isDeprecatedPreviewOperationId(operationId: string): boolean {
  return DEPRECATED_PREVIEW_OPERATION_ID_SET.has(operationId);
}

export function isDeprecatedPreviewSurfacePath(surfacePath: string): boolean {
  return DEPRECATED_PREVIEW_SURFACE_PATH_SET.has(surfacePath);
}
