import type { SourceSelectionConfig, SourceSelectionRule } from "@internal/dashboard/webhooks";

export type EditableSourceSelectionAction = "include" | "exclude";

export type DraftSourceSelectionRule = {
  id: string;
  action: EditableSourceSelectionAction;
  pattern: string;
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
