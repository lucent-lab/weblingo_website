import { describe, expect, it } from "vitest";

import {
  addOrReplaceRule,
  descendantPatternForPath,
  normalizeRulesForForm,
  removeRulesByPattern,
  sourceSelectionFingerprint,
  toSourceSelectionConfig,
} from "./source-selection-model";

describe("source-selection model helpers", () => {
  it("normalizes editable rules without preserving unsupported backend actions", () => {
    expect(
      normalizeRulesForForm([
        { action: "include", pattern: "/blog/*" },
        { action: "exclude", pattern: "/drafts/*" },
        { action: "canonical_source", pattern: "/fr/*", canonicalSourcePattern: "/blog/*" },
      ]),
    ).toEqual([
      { id: "persisted-0-include-/blog/*", action: "include", pattern: "/blog/*" },
      { id: "persisted-1-exclude-/drafts/*", action: "exclude", pattern: "/drafts/*" },
    ]);
  });

  it("trims and replaces editable draft rules by normalized pattern", () => {
    const rules = addOrReplaceRule([{ id: "rule-1", action: "include", pattern: "/blog/*" }], {
      action: "exclude",
      pattern: " /blog/* ",
    });

    expect(rules).toEqual([{ id: "rule-1", action: "exclude", pattern: "/blog/*" }]);
    expect(toSourceSelectionConfig(rules)).toEqual({
      rules: [{ action: "exclude", pattern: "/blog/*" }],
    });
  });

  it("removes rules and creates descendant patterns with root handling", () => {
    const rules = [
      { id: "rule-1", action: "include" as const, pattern: "/blog/*" },
      { id: "rule-2", action: "exclude" as const, pattern: "/drafts/*" },
    ];

    expect(removeRulesByPattern(rules, " /blog/* ")).toEqual([rules[1]]);
    expect(descendantPatternForPath("/")).toBe("/*");
    expect(descendantPatternForPath("/blog/")).toBe("/blog/*");
  });

  it("builds the save fingerprint from trimmed editable rules in order", () => {
    expect(
      sourceSelectionFingerprint({
        rules: [
          { action: "include", pattern: " /blog/* " },
          { action: "exclude", pattern: "/drafts/*" },
        ],
      }),
    ).toBe(
      JSON.stringify({
        rules: [
          { action: "include", pattern: "/blog/*" },
          { action: "exclude", pattern: "/drafts/*" },
        ],
      }),
    );
  });
});
