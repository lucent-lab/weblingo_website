import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildUserFacingOpenApiSpec,
  collectOperationIdsFromSpec,
  getUserFacingApiOperationIds,
  parsePlaybooksMarkdown,
  type FeatureCatalog,
  type OpenApiSpec,
} from "../../components/docs/api-reference-data";
import {
  DEPRECATED_PREVIEW_OPERATION_IDS,
  DEPRECATED_PREVIEW_SURFACE_PATHS,
} from "../../components/docs/deprecated-preview-filters";
import { getWorkflowPlaybooks } from "../../content/docs/workflow-playbooks";

function readUtf8OrThrow(relativePath: string): string {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`[docs] Required file is missing: ${relativePath}`);
  }
  return readFileSync(absolutePath, "utf8");
}

describe("docs feature coverage", () => {
  const openApiSpec = JSON.parse(
    readUtf8OrThrow("content/docs/_generated/backend-openapi.snapshot.json"),
  ) as OpenApiSpec;
  const featureCatalog = JSON.parse(
    readUtf8OrThrow("content/docs/_generated/backend-feature-catalog.snapshot.json"),
  ) as FeatureCatalog;
  const playbooksMarkdown = readUtf8OrThrow(
    "content/docs/_generated/backend-playbooks.snapshot.md",
  );
  const parsedPlaybooks = parsePlaybooksMarkdown(playbooksMarkdown);
  const apiReferenceMarkdown = readUtf8OrThrow("content/docs/api-reference.mdx");
  const userFacingSpec = buildUserFacingOpenApiSpec(openApiSpec, featureCatalog);
  const features = featureCatalog.features ?? [];
  const renderedOperationIds = collectOperationIdsFromSpec(userFacingSpec);
  const playbookOperationIds = new Set(
    parsedPlaybooks.flatMap((playbook) => playbook.operationIds),
  );
  const workflowPlaybooks = getWorkflowPlaybooks();

  it("mounts redoc component and links users to workflow docs", () => {
    expect(apiReferenceMarkdown).toContain("<RedocApiReference />");
    expect(apiReferenceMarkdown).not.toContain("<ApiPlaybookSummary />");
    expect(apiReferenceMarkdown).toContain("../workflows");
    expect(apiReferenceMarkdown).toContain("`sites.locales.serve`");
    expect(apiReferenceMarkdown).toContain("/{path}");
    expect(apiReferenceMarkdown).toContain("/api/prospect-showcases");
    for (const surfacePath of DEPRECATED_PREVIEW_SURFACE_PATHS) {
      expect(apiReferenceMarkdown).not.toContain(surfacePath);
    }
  });

  it("builds user-facing workflow pages from synced playbooks", () => {
    expect(workflowPlaybooks.length).toBeGreaterThan(0);
    const workflowOperationIds = new Set(
      workflowPlaybooks.flatMap((playbook) => playbook.operationIds),
    );
    expect(workflowOperationIds).toContain("digests.subscription.upsert");
    expect(workflowOperationIds).toContain("sites.locales.translationSummary.put");
    for (const playbook of workflowPlaybooks) {
      expect(playbook.slug.length).toBeGreaterThan(0);
      expect(playbook.stepDetails.length).toBeGreaterThan(0);
      expect(playbook.operationIds.length + playbook.surfacePaths.length).toBeGreaterThan(0);
      for (const surfacePath of DEPRECATED_PREVIEW_SURFACE_PATHS) {
        expect(playbook.surfacePaths).not.toContain(surfacePath);
      }
      for (const operationId of DEPRECATED_PREVIEW_OPERATION_IDS) {
        expect(playbook.operationIds).not.toContain(operationId);
      }
    }
  });

  it("renders every user-facing API capability operationId in redoc spec", () => {
    const userFacingOperationIds = Array.from(getUserFacingApiOperationIds(featureCatalog));
    const missing = userFacingOperationIds.filter(
      (operationId) => !renderedOperationIds.has(operationId),
    );
    expect(missing).toEqual([]);
  });

  it("does not expose deprecated preview API operationIds in redoc spec", () => {
    for (const operationId of DEPRECATED_PREVIEW_OPERATION_IDS) {
      expect(renderedOperationIds).not.toContain(operationId);
    }
    expect(renderedOperationIds).toContain("prospectShowcases.create");
    expect(renderedOperationIds).toContain("prospectShowcases.status");
    expect(renderedOperationIds).toContain("prospectShowcases.stream");
  });

  it("does not expose internal API operationIds in redoc spec", () => {
    const internalOperationIds = features
      .filter((entry) => entry.family === "api" && !entry.userFacing)
      .map((entry) => entry.endpoint?.operationId)
      .filter((operationId): operationId is string => typeof operationId === "string");

    const leaked = internalOperationIds.filter((operationId) =>
      renderedOperationIds.has(operationId),
    );
    expect(leaked).toEqual([]);
  });

  it("only references operationIds that exist in the synced feature catalog", () => {
    const knownOperationIds = new Set(
      features
        .filter((entry) => entry.family === "api")
        .map((entry) => entry.endpoint?.operationId)
        .filter((operationId): operationId is string => typeof operationId === "string"),
    );

    const unknownInPlaybooks = [...playbookOperationIds]
      .filter((operationId) => !knownOperationIds.has(operationId))
      .sort((left, right) => left.localeCompare(right));

    expect(unknownInPlaybooks).toEqual([]);
  });
});
