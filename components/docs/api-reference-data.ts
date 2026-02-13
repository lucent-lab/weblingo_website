export type OpenApiTag = {
  name?: string;
  [key: string]: unknown;
};

export type OpenApiOperation = {
  operationId?: string;
  tags?: string[];
  [key: string]: unknown;
};

export type OpenApiSpec = {
  openapi?: string;
  info?: Record<string, unknown>;
  servers?: Array<Record<string, unknown>>;
  paths?: Record<string, Record<string, OpenApiOperation>>;
  tags?: OpenApiTag[];
  components?: Record<string, unknown>;
  [key: string]: unknown;
};

export type FeatureCatalogEntry = {
  family?: string;
  userFacing?: boolean;
  endpoint?: {
    operationId?: string;
  };
};

export type FeatureCatalog = {
  features?: FeatureCatalogEntry[];
};

export type ParsedPlaybook = {
  id: string;
  title: string;
  anchor: string;
  notes: string[];
  steps: string[];
  stepDetails: Array<{
    text: string;
    operationIds: string[];
    surfacePaths: string[];
  }>;
  operationIds: string[];
  surfacePaths: string[];
};

export function toAnchor(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function toOperationAnchor(operationId: string): string {
  return `endpoint-${toAnchor(operationId)}`;
}

export function getUserFacingApiOperationIds(catalog: FeatureCatalog): Set<string> {
  return new Set(
    (catalog.features ?? [])
      .filter((entry) => entry.family === "api" && entry.userFacing)
      .map((entry) => entry.endpoint?.operationId)
      .filter((operationId): operationId is string => typeof operationId === "string"),
  );
}

export function collectOperationIdsFromSpec(spec: OpenApiSpec): Set<string> {
  const ids = new Set<string>();
  for (const methods of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(methods ?? {})) {
      const operationId = operation.operationId;
      if (operationId) {
        ids.add(operationId);
      }
    }
  }
  return ids;
}

export function buildUserFacingOpenApiSpec(
  spec: OpenApiSpec,
  catalog: FeatureCatalog,
): OpenApiSpec {
  const userFacingOperationIds = getUserFacingApiOperationIds(catalog);
  const filteredPaths: Record<string, Record<string, OpenApiOperation>> = {};
  const usedTags = new Set<string>();

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    const keptMethods: Record<string, OpenApiOperation> = {};
    for (const [method, operation] of Object.entries(methods ?? {})) {
      const operationId = operation.operationId;
      if (!operationId || !userFacingOperationIds.has(operationId)) {
        continue;
      }
      keptMethods[method] = operation;
      for (const tag of operation.tags ?? []) {
        usedTags.add(tag);
      }
    }
    if (Object.keys(keptMethods).length > 0) {
      filteredPaths[path] = keptMethods;
    }
  }

  const filteredTags = Array.isArray(spec.tags)
    ? spec.tags.filter((tag) => {
        if (!tag.name) {
          return false;
        }
        return usedTags.has(tag.name);
      })
    : undefined;
  const info = {
    ...(spec.info ?? {}),
    title: "WebLingo API",
    description:
      "User-facing API for account setup, site/domain configuration, crawl and translation workflows, previews, and notifications.",
  };
  const servers = [{ url: "/api", description: "WebLingo API base path" }];

  return {
    ...spec,
    info,
    servers,
    paths: filteredPaths,
    tags: filteredTags,
  };
}

export function parsePlaybooksMarkdown(markdown: string): ParsedPlaybook[] {
  const lines = markdown.split(/\r?\n/);
  const playbooks: ParsedPlaybook[] = [];
  let current: ParsedPlaybook | null = null;
  let currentStep: {
    text: string;
    operationIds: string[];
    surfacePaths: string[];
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^##\s+(Playbook.*)$/);
    if (headingMatch) {
      if (current) {
        playbooks.push(current);
      }
      const title = headingMatch[1].trim();
      const anchor = toAnchor(title);
      current = {
        id: anchor,
        title,
        anchor,
        notes: [],
        steps: [],
        stepDetails: [],
        operationIds: [],
        surfacePaths: [],
      };
      currentStep = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const stepMatch = line.match(/^\d+\.\s+(.*)$/);
    if (stepMatch) {
      const text = stepMatch[1].trim();
      current.steps.push(text);
      currentStep = {
        text,
        operationIds: [],
        surfacePaths: [],
      };
      current.stepDetails.push(currentStep);
      continue;
    }

    const operationMatch = line.match(/`operationId`:\s*`([^`]+)`/);
    if (operationMatch) {
      const operationId = operationMatch[1].trim();
      current.operationIds.push(operationId);
      if (currentStep) {
        currentStep.operationIds.push(operationId);
      }
      continue;
    }

    const surfaceMatch = line.match(/`(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s+([^`]+)`/);
    if (surfaceMatch) {
      const surfacePath = surfaceMatch[1].trim();
      current.surfacePaths.push(surfacePath);
      if (currentStep) {
        currentStep.surfacePaths.push(surfacePath);
      }
      continue;
    }

    const cleanLine = line.trim();
    if (
      cleanLine &&
      !cleanLine.startsWith("-") &&
      !cleanLine.startsWith("```") &&
      !cleanLine.startsWith("#")
    ) {
      current.notes.push(cleanLine);
    }
  }

  if (current) {
    playbooks.push(current);
  }

  return playbooks.map((playbook) => ({
    ...playbook,
    stepDetails: playbook.stepDetails.map((step) => ({
      ...step,
      operationIds: Array.from(new Set(step.operationIds)),
      surfacePaths: Array.from(new Set(step.surfacePaths)),
    })),
    operationIds: Array.from(new Set(playbook.operationIds)),
    surfacePaths: Array.from(new Set(playbook.surfacePaths)),
  }));
}
