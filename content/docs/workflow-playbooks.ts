import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import featureCatalog from "@/content/docs/_generated/backend-feature-catalog.snapshot.json";
import {
  getUserFacingApiOperationIds,
  parsePlaybooksMarkdown,
  toAnchor,
  type FeatureCatalog,
  type ParsedPlaybook,
} from "@/components/docs/api-reference-data";
import {
  isDeprecatedPreviewOperationId,
  isDeprecatedPreviewSurfacePath,
} from "@/components/docs/deprecated-preview-filters";

const SERVE_SURFACE_PATHS = new Set(["/{path}"]);

export type WorkflowPlaybook = ParsedPlaybook & {
  slug: string;
  shortTitle: string;
};

function readPlaybooksSnapshotOrThrow(): string {
  const playbooksPath = resolve(
    process.cwd(),
    "content/docs/_generated/backend-playbooks.snapshot.md",
  );
  if (!existsSync(playbooksPath)) {
    throw new Error(
      "[docs] Missing generated playbooks snapshot: content/docs/_generated/backend-playbooks.snapshot.md",
    );
  }
  return readFileSync(playbooksPath, "utf8");
}

function toShortTitle(title: string): string {
  const trimmed = title.trim();
  const withoutPrefix = trimmed.replace(/^Playbook(?:\s+\d+)?\s*:\s*/i, "").trim();
  return withoutPrefix || trimmed;
}

function uniqueInOriginalOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stripDeprecatedPreviewReferences(playbook: ParsedPlaybook): ParsedPlaybook {
  const filteredStepDetails = playbook.stepDetails
    .map((step) => {
      const originalReferenceCount = step.operationIds.length + step.surfacePaths.length;
      const operationIds = step.operationIds.filter(
        (operationId) => !isDeprecatedPreviewOperationId(operationId),
      );
      const surfacePaths = step.surfacePaths.filter(
        (surfacePath) => !isDeprecatedPreviewSurfacePath(surfacePath),
      );
      return {
        ...step,
        operationIds,
        surfacePaths,
        originalReferenceCount,
      };
    })
    .filter((step) => {
      return (
        step.originalReferenceCount === 0 || step.operationIds.length + step.surfacePaths.length > 0
      );
    });
  const stepDetails = filteredStepDetails.map((step) => ({
    text: step.text,
    operationIds: step.operationIds,
    surfacePaths: step.surfacePaths,
  }));

  return {
    ...playbook,
    steps: stepDetails.map((step) => step.text),
    stepDetails,
    operationIds: uniqueInOriginalOrder(
      playbook.operationIds.filter((operationId) => !isDeprecatedPreviewOperationId(operationId)),
    ),
    surfacePaths: uniqueInOriginalOrder(
      playbook.surfacePaths.filter((surfacePath) => !isDeprecatedPreviewSurfacePath(surfacePath)),
    ),
  };
}

function withStableSlugs(playbooks: ParsedPlaybook[]): WorkflowPlaybook[] {
  const used = new Map<string, number>();
  return playbooks.map((playbook) => {
    const shortTitle = toShortTitle(playbook.title);
    const baseSlug = toAnchor(shortTitle);
    const previousCount = used.get(baseSlug) ?? 0;
    const nextCount = previousCount + 1;
    used.set(baseSlug, nextCount);
    const slug = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;
    return {
      ...playbook,
      shortTitle,
      slug,
    };
  });
}

export function getWorkflowPlaybooks(): WorkflowPlaybook[] {
  const playbooks = parsePlaybooksMarkdown(readPlaybooksSnapshotOrThrow()).map(
    stripDeprecatedPreviewReferences,
  );
  const userFacingOperationIds = getUserFacingApiOperationIds(
    featureCatalog as unknown as FeatureCatalog,
  );

  const filtered = playbooks.filter((playbook) => {
    if (playbook.operationIds.some((operationId) => userFacingOperationIds.has(operationId))) {
      return true;
    }
    return playbook.surfacePaths.some((surfacePath) => SERVE_SURFACE_PATHS.has(surfacePath));
  });

  return withStableSlugs(filtered);
}

export function getWorkflowPlaybookBySlug(slug: string): WorkflowPlaybook | null {
  return getWorkflowPlaybooks().find((playbook) => playbook.slug === slug) ?? null;
}
