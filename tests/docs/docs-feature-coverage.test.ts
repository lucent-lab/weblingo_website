import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type CatalogEntry = {
  family: string;
  userFacing: boolean;
  endpoint?: {
    operationId?: string;
  };
  surfaces?: Array<{
    path?: string;
  }>;
};

type FeatureCatalog = {
  features: CatalogEntry[];
};

function readUtf8OrThrow(relativePath: string): string {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`[docs] Required file is missing: ${relativePath}`);
  }
  return readFileSync(absolutePath, "utf8");
}

function parseOperationIdsFromPlaybooks(playbooksMarkdown: string): Set<string> {
  const ids = new Set<string>();
  const matcher = /`operationId`:\s*`([^`]+)`/g;
  for (const match of playbooksMarkdown.matchAll(matcher)) {
    const operationId = match[1]?.trim();
    if (operationId) {
      ids.add(operationId);
    }
  }
  return ids;
}

describe("docs feature coverage", () => {
  const featureCatalog = JSON.parse(
    readUtf8OrThrow("content/docs/_generated/backend-feature-catalog.snapshot.json"),
  ) as FeatureCatalog;
  const playbooksMarkdown = readUtf8OrThrow(
    "content/docs/_generated/backend-playbooks.snapshot.md",
  );
  const apiReferenceMarkdown = readUtf8OrThrow("content/docs/api-reference.mdx");
  const playbookOperationIds = parseOperationIdsFromPlaybooks(playbooksMarkdown);

  it("documents every user-facing API capability operationId", () => {
    const userFacingOperationIds = featureCatalog.features
      .filter((entry) => entry.family === "api" && entry.userFacing)
      .map((entry) => entry.endpoint?.operationId)
      .filter((operationId): operationId is string => typeof operationId === "string")
      .sort((left, right) => left.localeCompare(right));

    const missing = userFacingOperationIds.filter(
      (operationId) => !apiReferenceMarkdown.includes(`\`${operationId}\``),
    );
    expect(missing).toEqual([]);
  });

  it("documents all user-facing serve surface paths and serving playbook", () => {
    const userFacingHttpPaths = featureCatalog.features
      .filter((entry) => entry.family === "http" && entry.userFacing)
      .flatMap((entry) => entry.surfaces ?? [])
      .map((surface) => surface.path)
      .filter((pathValue): pathValue is string => typeof pathValue === "string")
      .sort((left, right) => left.localeCompare(right));

    const missingPaths = userFacingHttpPaths.filter(
      (pathValue) => !apiReferenceMarkdown.includes(`\`${pathValue}\``),
    );
    expect(missingPaths).toEqual([]);
    expect(apiReferenceMarkdown).toContain("Playbook: Serving Access and Previews");
  });

  it("does not expose internal API operationIds in the user-facing API reference", () => {
    const internalOperationIds = featureCatalog.features
      .filter((entry) => entry.family === "api" && !entry.userFacing)
      .map((entry) => entry.endpoint?.operationId)
      .filter((operationId): operationId is string => typeof operationId === "string");

    const leaked = internalOperationIds.filter((operationId) =>
      apiReferenceMarkdown.includes(`\`${operationId}\``),
    );
    expect(leaked).toEqual([]);
  });

  it("only references operationIds that exist in the synced feature catalog", () => {
    const knownOperationIds = new Set(
      featureCatalog.features
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
