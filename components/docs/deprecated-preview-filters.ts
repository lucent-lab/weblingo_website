const DEPRECATED_PREVIEW_OPERATION_IDS = new Set([
  "previews.create",
  "previews.feedback",
  "previews.status",
  "previews.updateEmail",
]);

const DEPRECATED_PREVIEW_SURFACE_PATHS = new Set(["/_preview/{previewId}"]);

export function isDeprecatedPreviewOperationId(operationId: string): boolean {
  return DEPRECATED_PREVIEW_OPERATION_IDS.has(operationId);
}

export function isDeprecatedPreviewSurfacePath(surfacePath: string): boolean {
  return DEPRECATED_PREVIEW_SURFACE_PATHS.has(surfacePath);
}
