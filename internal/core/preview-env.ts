import "server-only";

import { z } from "zod";

const previewEnvSchema = z.object({
  PREVIEW_BASE_URL: z.string().url(),
});

export type PreviewEnv = z.infer<typeof previewEnvSchema>;

const readPreviewEnv = () => ({
  PREVIEW_BASE_URL: process.env.PREVIEW_BASE_URL,
});

export const envPreview: PreviewEnv = previewEnvSchema.parse(readPreviewEnv());
