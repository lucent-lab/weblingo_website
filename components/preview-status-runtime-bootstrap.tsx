"use client";

import { usePreviewStatusRuntime } from "@internal/previews/use-preview-status-runtime";

export function PreviewStatusRuntimeBootstrap() {
  usePreviewStatusRuntime();
  return null;
}
