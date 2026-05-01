import type {
  SourceSelectionConfig,
  SourceSelectionPreviewPage,
  SourceSelectionRule,
} from "@internal/dashboard/webhooks";

export type EditableSourceSelectionAction = "include" | "exclude";

export type DraftSourceSelectionRule = {
  id: string;
  action: EditableSourceSelectionAction;
  pattern: string;
};

export type SourceSelectionTreeRow =
  | {
      id: string;
      kind: "folder";
      path: string;
      depth: number;
      totalCount: number;
      includedCount: number;
      excludedCount: number;
      effectiveState: "included" | "excluded" | "mixed";
      descendantRuleAction: EditableSourceSelectionAction | null;
    }
  | {
      id: string;
      kind: "page";
      path: string;
      depth: number;
      page: SourceSelectionPreviewPage;
    };

export function normalizeRulesForForm(
  rules: readonly SourceSelectionRule[] | null | undefined,
): DraftSourceSelectionRule[] {
  return (rules ?? [])
    .filter(
      (rule): rule is SourceSelectionRule & { action: EditableSourceSelectionAction } =>
        rule.action === "include" || rule.action === "exclude",
    )
    .map((rule, index) => ({
      id: `persisted-${index}-${rule.action}-${rule.pattern}`,
      action: rule.action,
      pattern: rule.pattern,
    }));
}

export function toSourceSelectionConfig(
  rules: readonly DraftSourceSelectionRule[],
): SourceSelectionConfig {
  return {
    rules: rules.map((rule) => ({
      action: rule.action,
      pattern: rule.pattern.trim(),
    })),
  };
}

export function sourceSelectionFingerprint(config: SourceSelectionConfig): string {
  return JSON.stringify({
    rules: config.rules.map((rule) => ({
      action: rule.action,
      pattern: rule.pattern.trim(),
    })),
  });
}

export function createDraftRule(
  action: EditableSourceSelectionAction,
  pattern: string,
): DraftSourceSelectionRule {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    action,
    pattern,
  };
}

export function addOrReplaceRule(
  rules: readonly DraftSourceSelectionRule[],
  nextRule: Omit<DraftSourceSelectionRule, "id">,
): DraftSourceSelectionRule[] {
  const normalizedPattern = nextRule.pattern.trim();
  let replaced = false;
  const next = rules.map((rule) => {
    if (rule.pattern.trim() !== normalizedPattern) {
      return rule;
    }
    replaced = true;
    return {
      ...rule,
      action: nextRule.action,
      pattern: normalizedPattern,
    };
  });
  if (replaced) {
    return next;
  }
  return [...next, createDraftRule(nextRule.action, normalizedPattern)];
}

export function removeRulesByPattern(
  rules: readonly DraftSourceSelectionRule[],
  pattern: string,
): DraftSourceSelectionRule[] {
  const normalizedPattern = pattern.trim();
  return rules.filter((rule) => rule.pattern.trim() !== normalizedPattern);
}

export function descendantPatternForPath(path: string): string {
  if (path === "/") {
    return "/*";
  }
  return `${path.replace(/\/$/, "")}/*`;
}

export function deriveDisplayTreeFromPreview(
  pages: readonly SourceSelectionPreviewPage[],
  draftRules: readonly DraftSourceSelectionRule[],
): SourceSelectionTreeRow[] {
  const sortedPages = [...pages].sort((left, right) =>
    compareSourcePaths(left.sourcePath, right.sourcePath),
  );

  const folderStats = new Map<
    string,
    { depth: number; totalCount: number; includedCount: number }
  >();

  for (const page of sortedPages) {
    const segments = splitSourcePath(page.sourcePath);
    let folderPath = "";
    for (let index = 0; index < segments.length - 1; index += 1) {
      folderPath = appendSourceSegment(folderPath, segments[index]);
      if (!folderStats.has(folderPath)) {
        folderStats.set(folderPath, {
          depth: index + 1,
          totalCount: 0,
          includedCount: 0,
        });
      }
    }
  }

  for (const page of sortedPages) {
    const segments = splitSourcePath(page.sourcePath);
    let folderPath = "";
    for (const segment of segments) {
      folderPath = appendSourceSegment(folderPath, segment);
      const stats = folderStats.get(folderPath);
      if (!stats) {
        continue;
      }
      stats.totalCount += 1;
      if (page.selected) {
        stats.includedCount += 1;
      }
    }
  }

  const descendantRuleActions = new Map<string, EditableSourceSelectionAction>();
  for (const rule of draftRules) {
    const normalizedPattern = rule.pattern.trim();
    if (!normalizedPattern.endsWith("/*")) {
      continue;
    }
    descendantRuleActions.set(normalizedPattern, rule.action);
  }

  const rows: SourceSelectionTreeRow[] = [];
  for (const [folderPath, stats] of folderStats) {
    const excludedCount = stats.totalCount - stats.includedCount;
    const descendantPattern = descendantPatternForPath(folderPath);
    const descendantRuleAction = descendantRuleActions.get(descendantPattern) ?? null;
    rows.push({
      id: `folder:${folderPath}`,
      kind: "folder",
      path: folderPath,
      depth: stats.depth,
      totalCount: stats.totalCount,
      includedCount: stats.includedCount,
      excludedCount,
      effectiveState:
        stats.includedCount === stats.totalCount
          ? "included"
          : excludedCount === stats.totalCount
            ? "excluded"
            : "mixed",
      descendantRuleAction,
    });
  }

  for (const page of sortedPages) {
    rows.push({
      id: `page:${page.sourcePath}`,
      kind: "page",
      path: page.sourcePath,
      depth: splitSourcePath(page.sourcePath).length,
      page,
    });
  }

  return rows.sort((left, right) => {
    const pathOrder = compareSourcePaths(left.path, right.path);
    if (pathOrder !== 0) {
      return pathOrder;
    }
    if (left.kind === right.kind) {
      return 0;
    }
    return left.kind === "folder" ? -1 : 1;
  });
}

function splitSourcePath(path: string): string[] {
  if (path === "/") {
    return [];
  }
  return path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
}

function appendSourceSegment(prefix: string, segment: string): string {
  return prefix ? `${prefix}/${segment}` : `/${segment}`;
}

function compareSourcePaths(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left === "/") {
    return -1;
  }
  if (right === "/") {
    return 1;
  }
  return left.localeCompare(right);
}
