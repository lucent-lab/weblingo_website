import { describe, expect, it } from "vitest";

import type { SourceSelectionPreviewPage } from "@internal/dashboard/webhooks";

import { deriveDisplayTreeFromPreview } from "./source-selection-model";

function page(sourcePath: string, selected: boolean): SourceSelectionPreviewPage {
  return {
    sourcePath,
    selected,
    reason: selected ? "included_by_rule" : "excluded_by_rule",
  };
}

describe("deriveDisplayTreeFromPreview", () => {
  it("builds folder stats without losing exact folder-path pages", () => {
    const rows = deriveDisplayTreeFromPreview(
      [page("/blog", true), page("/blog/post-1", true), page("/blog/drafts/one", false)],
      [{ id: "rule-1", action: "exclude", pattern: "/blog/drafts/*" }],
    );

    const blog = rows.find((row) => row.kind === "folder" && row.path === "/blog");
    expect(blog).toMatchObject({
      totalCount: 3,
      includedCount: 2,
      excludedCount: 1,
      effectiveState: "mixed",
      descendantRuleAction: null,
    });

    const drafts = rows.find((row) => row.kind === "folder" && row.path === "/blog/drafts");
    expect(drafts).toMatchObject({
      totalCount: 1,
      includedCount: 0,
      excludedCount: 1,
      effectiveState: "excluded",
      descendantRuleAction: "exclude",
    });
  });
});
