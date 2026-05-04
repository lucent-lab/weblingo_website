// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "@/app/dashboard/actions";
import type {
  SourceSelectionRule,
  SourceSelectionTreePreviewNode,
  SourceSelectionTreePreviewResponse,
} from "@internal/dashboard/webhooks";

import { SourceSelectionManager, type SourceSelectionCopy } from "./source-selection-manager";

type SaveSourceSelectionAction = (
  prev: ActionResponse | undefined,
  formData: FormData,
) => Promise<ActionResponse>;

const copy: SourceSelectionCopy = {
  title: "Source selection",
  description: "Preview source rules.",
  persistedTitle: "Current saved rules",
  persistedDescription: "Persisted rules.",
  proposedTitle: "Proposed changes",
  proposedDescription: "Preview before saving.",
  noRules: "No rules. Unmatched pages are included.",
  unsavedChanges: "Unsaved changes",
  inSync: "Saved state",
  actionLabel: "Action",
  patternLabel: "Pattern",
  patternPlaceholder: "/blog/*",
  includeAction: "Include",
  excludeAction: "Exclude",
  addIncludeRule: "Add include rule",
  addExcludeRule: "Add exclude rule",
  removeRule: "Remove rule",
  ruleLimitLabel: "{count}/{limit} rules used",
  ruleLimitHelp: "Use section rules like /blog/* to keep the rule set compact.",
  ruleLimitNear: "Near the 200-rule limit. Prefer section rules before adding more page rules.",
  ruleChangeNew: "New",
  ruleChangeEdited: "Edited",
  ruleChangeRemoved: "Removed on save",
  summaryTitle: "Preview summary",
  summaryDescription: "Backend counts.",
  knownIncluded: "Known included",
  knownExcluded: "Known excluded",
  includedByDefault: "Default include",
  includedByRule: "Included by rule",
  excludedByRule: "Excluded by rule",
  notIncludedByRule: "Not included by rule",
  rulesTotal: "Rules",
  warningsTitle: "Preview warnings",
  validationTitle: "Rules need changes",
  previewErrorTitle: "Unable to preview rules.",
  previewLoading: "Previewing rules...",
  previewReady: "Preview is current.",
  previewBlocked: "Preview failed. Save is blocked.",
  pagesTitle: "Known source pages",
  pagesDescription: "Backend decisions.",
  pagesEmpty: "No known pages returned by preview.",
  filterLabel: "Search source paths",
  filterPlaceholder: "/blog",
  filterHelp: "Searches globally across known backend source paths.",
  filterNoResults: "No backend source paths match the search.",
  clearFilter: "Clear filter",
  inventoryNote:
    "This view shows known discovered source paths returned by preview. It is not a live crawl of every possible origin URL.",
  currentFolder: "Current folder",
  parentFolder: "Parent folder",
  rootFolder: "Root",
  openFolder: "Open folder",
  pageColumn: "Path",
  stateColumn: "State",
  reasonColumn: "Reason",
  actionsColumn: "Actions",
  selected: "Selected",
  selectedOnPage: "Selected on this preview page",
  excluded: "Excluded",
  mixed: "Mixed",
  defaultState: "Default",
  direct: "Direct",
  inherited: "Inherited",
  changed: "Changed",
  changedOnPage: "{count} changed on this preview page",
  matchedPattern: "Matched",
  noMatchedPattern: "No matched rule",
  includePage: "Include page",
  excludePage: "Exclude page",
  inheritPage: "Clear page rule",
  includeDescendants: "Include section",
  excludeDescendants: "Exclude section",
  inheritDescendants: "Clear section rule",
  descendantsHelp: "Section controls save a /* rule and apply to future descendants.",
  exactHelp: "Page controls save an exact path rule for this page only.",
  previousPage: "Previous",
  nextPage: "Next",
  paginationLabel: "{start}-{end} of {total} previewed paths",
  save: "Save source selection",
  saving: "Saving...",
  saveDisabled: "Save after preview.",
  saved: "Source selection saved.",
  reset: "Reset changes",
  reasonLabels: {
    included_by_default: "Included by default",
    included_by_rule: "Included by rule",
    excluded_by_rule: "Excluded by rule",
    canonicalized_by_rule: "Canonicalized by rule",
    not_included_by_rule: "Excluded because include rules create an allowlist",
  },
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

type TestPreviewPage = {
  sourcePath: string;
  selected: boolean;
  reason: NonNullable<SourceSelectionTreePreviewNode["reason"]>;
  effectiveState: "included" | "excluded" | "canonicalized";
  previousSelected: boolean;
  previousReason: NonNullable<SourceSelectionTreePreviewNode["previousReason"]>;
  changed: boolean;
  matchedPattern?: string;
  matchedAction?: SourceSelectionTreePreviewNode["matchedAction"];
  ruleScope?: SourceSelectionTreePreviewNode["ruleScope"];
  directRule?: SourceSelectionTreePreviewNode["directRule"];
  inheritedRule?: SourceSelectionTreePreviewNode["inheritedRule"];
  canonicalSourcePath?: string;
};

type TestPreviewOverrides = Partial<Omit<SourceSelectionTreePreviewResponse, "pagination">> & {
  affectedPages?: TestPreviewPage[];
  pagination?: Partial<SourceSelectionTreePreviewResponse["pagination"]> & { offset?: number };
};

function makePreview(overrides: TestPreviewOverrides = {}): SourceSelectionTreePreviewResponse {
  const affectedPages = overrides.affectedPages ?? [
    {
      sourcePath: "/",
      selected: true,
      reason: "included_by_default",
      effectiveState: "included",
      previousSelected: true,
      previousReason: "included_by_default",
      changed: false,
    },
  ];
  const sourceSelection = overrides.sourceSelection ?? { rules: [] };
  const nodes = overrides.nodes ?? buildTestTreeNodes(affectedPages, sourceSelection);
  const total = overrides.pagination?.total ?? nodes.length;
  return {
    sourceSelection,
    summary: overrides.summary ?? {
      knownPagesTotal: affectedPages.length,
      knownPagesIncluded: affectedPages.filter((page) => page.selected).length,
      knownPagesExcluded: affectedPages.filter((page) => !page.selected).length,
      includedByDefault: affectedPages.filter((page) => page.reason === "included_by_default")
        .length,
      includedByRule: affectedPages.filter((page) => page.reason === "included_by_rule").length,
      excludedByRule: affectedPages.filter((page) => page.reason === "excluded_by_rule").length,
      notIncludedByRule: affectedPages.filter((page) => page.reason === "not_included_by_rule")
        .length,
      canonicalizedByRule: 0,
      rulesTotal: overrides.sourceSelection?.rules.length ?? 0,
    },
    nodes,
    pagination: {
      limit: 100,
      total,
      hasMore: false,
      ...overrides.pagination,
    },
    warnings: overrides.warnings ?? [],
    impact: overrides.impact ?? {
      scope: "known_pages",
      changedKnownPages: affectedPages.filter((page) => page.changed).length,
      selectedToExcluded: {
        count: affectedPages.filter((page) => page.previousSelected && !page.selected).length,
        sourcePaths: affectedPages
          .filter((page) => page.previousSelected && !page.selected)
          .map((page) => page.sourcePath),
      },
      activeSiteRerun: {
        required: false,
        basis: "site_status_and_config_change",
        activeDeploymentCount: 0,
        deploymentImpact: "not_estimated",
      },
    },
    inventory: overrides.inventory ?? {
      knownPagesTotal: affectedPages.length,
      resultNodesTotal: total,
      resultMode: "children",
      summaryScope: "global_known_pages",
      resultScope: "filtered_tree_nodes",
      parentPath: "/",
      maxPageSize: 200,
      complete: true,
    },
  };
}

function buildTestTreeNodes(
  pages: readonly TestPreviewPage[],
  sourceSelection: { rules: SourceSelectionRule[] },
): SourceSelectionTreePreviewNode[] {
  const folderStats = new Map<
    string,
    { total: number; included: number; changed: number; hasChildren: boolean }
  >();
  for (const page of pages) {
    for (const folderPath of ancestorFolderPaths(page.sourcePath)) {
      const stats = folderStats.get(folderPath) ?? {
        total: 0,
        included: 0,
        changed: 0,
        hasChildren: false,
      };
      stats.total += 1;
      if (page.selected) stats.included += 1;
      if (page.changed) stats.changed += 1;
      folderStats.set(folderPath, stats);
    }
    const parent = parentSourcePath(page.sourcePath);
    const parentStats = folderStats.get(parent);
    if (parentStats) parentStats.hasChildren = true;
  }
  for (const folderPath of folderStats.keys()) {
    const parent = parentSourcePath(folderPath);
    const parentStats = folderStats.get(parent);
    if (parentStats && parent !== folderPath) parentStats.hasChildren = true;
  }

  const nodes: SourceSelectionTreePreviewNode[] = [];
  for (const [path, stats] of folderStats) {
    const descendantPattern = path === "/" ? "/*" : `${path}/*`;
    const descendantRule = sourceSelection.rules.find((rule) => rule.pattern === descendantPattern);
    nodes.push({
      id: `folder:${path}`,
      kind: "folder",
      sourcePath: path,
      depth: sourcePathDepth(path),
      hasChildren: stats.hasChildren,
      selected:
        stats.included === stats.total
          ? true
          : stats.included === 0 && stats.total > 0
            ? false
            : null,
      effectiveState:
        stats.included === stats.total ? "included" : stats.included === 0 ? "excluded" : "mixed",
      changed: stats.changed > 0,
      knownPagesTotal: stats.total,
      knownPagesIncluded: stats.included,
      knownPagesExcluded: stats.total - stats.included,
      changedKnownPages: stats.changed,
      ...(descendantRule ? { descendantRule } : {}),
    });
  }
  for (const page of pages) {
    nodes.push({
      id: `page:${page.sourcePath}`,
      kind: "page",
      sourcePath: page.sourcePath,
      depth: sourcePathDepth(page.sourcePath),
      hasChildren: folderStats.has(page.sourcePath),
      selected: page.selected,
      reason: page.reason,
      effectiveState: page.effectiveState,
      previousSelected: page.previousSelected,
      previousReason: page.previousReason,
      changed: page.changed,
      knownPagesTotal: 1,
      knownPagesIncluded: page.selected ? 1 : 0,
      knownPagesExcluded: page.selected ? 0 : 1,
      changedKnownPages: page.changed ? 1 : 0,
      ...(page.matchedPattern ? { matchedPattern: page.matchedPattern } : {}),
      ...(page.matchedAction ? { matchedAction: page.matchedAction } : {}),
      ...(page.ruleScope ? { ruleScope: page.ruleScope } : {}),
      ...(page.directRule !== undefined ? { directRule: page.directRule } : {}),
      ...(page.inheritedRule !== undefined ? { inheritedRule: page.inheritedRule } : {}),
      ...(page.canonicalSourcePath ? { canonicalSourcePath: page.canonicalSourcePath } : {}),
    });
  }
  return nodes.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

function ancestorFolderPaths(path: string): string[] {
  const segments = path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const segment of segments.slice(0, -1)) {
    current = current ? `${current}/${segment}` : `/${segment}`;
    out.push(current);
  }
  return out;
}

function parentSourcePath(path: string): string {
  const segments = path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "/";
  }
  return `/${segments.slice(0, -1).join("/")}`;
}

function sourcePathDepth(path: string): number {
  return path === "/" ? 0 : path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").length;
}

function validationError(message: string, field = "sourceSelection.rules[0].pattern") {
  return {
    error: message,
    details: {
      code: "source_selection_validation_failed",
      validation: { field, message },
    },
  };
}

function renderManager(options?: {
  initialRules?: SourceSelectionRule[];
  routeConfigUpdatedAt?: string | null;
  sourceSelectionFingerprint?: string | null;
  saveAction?: SaveSourceSelectionAction;
}) {
  const saveAction =
    options?.saveAction ??
    vi.fn<SaveSourceSelectionAction>(async () => ({
      ok: true,
      message: "Source selection saved.",
    }));
  const view = render(
    <SourceSelectionManager
      siteId="site-1"
      initialRules={options?.initialRules ?? []}
      routeConfigUpdatedAt={options?.routeConfigUpdatedAt ?? null}
      sourceSelectionFingerprint={options?.sourceSelectionFingerprint ?? null}
      canEdit={true}
      saveAction={saveAction}
      copy={copy}
    />,
  );
  return { ...view, saveAction };
}

async function runPreviewTimer() {
  await act(async () => {
    vi.advanceTimersByTime(350);
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SourceSelectionManager", () => {
  it("previews proposed flat rules before saving and saves through the provided action", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as {
        sourceSelection: { rules: SourceSelectionRule[] };
      };
      return new Response(
        JSON.stringify(
          makePreview({
            sourceSelection: body.sourceSelection,
            affectedPages: [
              {
                sourcePath: "/blog",
                selected: true,
                reason: "included_by_rule",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
                matchedPattern: "/blog/*",
                matchedAction: "include",
                ruleScope: "inherited",
                directRule: null,
                inheritedRule: { action: "include", pattern: "/blog/*" },
              },
            ],
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const saveAction = vi.fn<SaveSourceSelectionAction>(async () => ({
      ok: true,
      message: "saved",
    }));

    renderManager({
      saveAction,
      routeConfigUpdatedAt: "2026-05-04T00:00:00.000Z",
      sourceSelectionFingerprint: "backend-fingerprint-before-save",
    });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/blog/*" } });
    await runPreviewTimer();

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/dashboard/sites/site-1/source-selection/tree-preview"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sourceSelection: { rules: [{ action: "include", pattern: "/blog/*" }] },
          includeUnknownFutureDescendants: true,
        }),
      }),
    );
    expect(saveAction).not.toHaveBeenCalled();

    expect(
      (screen.getByRole("button", { name: /save source selection/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /save source selection/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(saveAction).toHaveBeenCalledOnce();
    const formData = saveAction.mock.calls[0]?.[1] as FormData;
    expect(JSON.parse(formData.get("sourceSelection") as string)).toEqual({
      rules: [{ action: "include", pattern: "/blog/*" }],
    });
    expect(formData.get("expectedSourceSelectionFingerprint")).toBe(
      "backend-fingerprint-before-save",
    );
    expect(formData.get("expectedRouteConfigUpdatedAt")).toBe("2026-05-04T00:00:00.000Z");
  });

  it("saves the successfully previewed draft instead of trusting the preview echo", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify(
          makePreview({
            sourceSelection: {
              rules: [
                {
                  action: "canonical_source",
                  pattern: "/localized/*",
                  canonicalSourcePattern: "/blog/*",
                },
              ],
            },
            affectedPages: [
              {
                sourcePath: "/blog/post-1",
                selected: true,
                reason: "included_by_rule",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
                matchedPattern: "/blog/*",
                matchedAction: "include",
              },
            ],
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const saveAction = vi.fn<SaveSourceSelectionAction>(async () => ({
      ok: true,
      message: "saved",
    }));

    renderManager({ saveAction });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/blog/*" } });
    await runPreviewTimer();
    fireEvent.click(screen.getByRole("button", { name: /save source selection/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const formData = saveAction.mock.calls[0]?.[1] as FormData;
    expect(JSON.parse(formData.get("sourceSelection") as string)).toEqual({
      rules: [{ action: "include", pattern: "/blog/*" }],
    });
  });

  it("keeps a newly added empty include rule from becoming a saveable allowlist", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makePreview()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(validationError("sourceSelection.rules[0].pattern needs a path")),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;
    const saveAction = vi.fn<SaveSourceSelectionAction>(async () => ({
      ok: true,
      message: "saved",
    }));

    renderManager({ saveAction });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    expect(screen.getByPlaceholderText("/blog/*")).toBeTruthy();
    await runPreviewTimer();

    expect(screen.getByText("Rules need changes")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /save source selection/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /save source selection/i }));
    expect(saveAction).not.toHaveBeenCalled();
  });

  it("disables rule edits while saving to avoid clobbering newer drafts", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as {
        sourceSelection: { rules: SourceSelectionRule[] };
      };
      return new Response(JSON.stringify(makePreview({ sourceSelection: body.sourceSelection })), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const save = createDeferred<ActionResponse>();
    const saveAction = vi.fn<SaveSourceSelectionAction>(() => save.promise);

    renderManager({ saveAction });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/blog/*" } });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: /save source selection/i }));

    const patternInput = screen.getByLabelText("Pattern") as HTMLInputElement;
    expect(patternInput.disabled).toBe(true);
    fireEvent.change(patternInput, { target: { value: "/products/*" } });
    expect(patternInput.value).toBe("/products/*");

    await act(async () => {
      save.resolve({ ok: true, message: "saved" });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((screen.getByLabelText("Pattern") as HTMLInputElement).value).toBe("/products/*");
  });

  it("renders include allowlists, exact rules, nested overrides, locale-looking paths, and metadata-neutral backend decisions", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            makePreview({
              sourceSelection: {
                rules: [
                  { action: "include", pattern: "/blog/*" },
                  { action: "exclude", pattern: "/blog/drafts/*" },
                  { action: "include", pattern: "/pricing" },
                ],
              },
              affectedPages: [
                {
                  sourcePath: "/blog/post-1",
                  selected: true,
                  reason: "included_by_rule",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                  matchedPattern: "/blog/*",
                  matchedAction: "include",
                  ruleScope: "inherited",
                  directRule: null,
                  inheritedRule: { action: "include", pattern: "/blog/*" },
                },
                {
                  sourcePath: "/blog/drafts/one",
                  selected: false,
                  reason: "excluded_by_rule",
                  effectiveState: "excluded",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: true,
                  matchedPattern: "/blog/drafts/*",
                  matchedAction: "exclude",
                  ruleScope: "inherited",
                  directRule: null,
                  inheritedRule: { action: "exclude", pattern: "/blog/drafts/*" },
                },
                {
                  sourcePath: "/pricing",
                  selected: true,
                  reason: "included_by_rule",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                  matchedPattern: "/pricing",
                  matchedAction: "include",
                  ruleScope: "direct",
                  directRule: { action: "include", pattern: "/pricing" },
                  inheritedRule: null,
                },
                {
                  sourcePath: "/products/widget",
                  selected: false,
                  reason: "not_included_by_rule",
                  effectiveState: "excluded",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: true,
                },
                {
                  sourcePath: "/ja",
                  selected: true,
                  reason: "included_by_rule",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                  matchedPattern: "/ja",
                  matchedAction: "include",
                  ruleScope: "direct",
                  directRule: { action: "include", pattern: "/ja" },
                  inheritedRule: null,
                } as TestPreviewPage & {
                  canonical?: string;
                  hreflang?: string;
                  htmlLang?: string;
                },
              ],
              warnings: [
                {
                  code: "include_rules_create_allowlist",
                  message:
                    "Unmatched paths will be excluded because at least one include rule is present.",
                },
              ],
              pagination: {
                limit: 100,
                offset: 0,
                total: 120,
                hasMore: true,
              },
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;

    renderManager({
      initialRules: [
        { action: "include", pattern: "/blog/*" },
        { action: "exclude", pattern: "/blog/drafts/*" },
        { action: "include", pattern: "/pricing" },
        { action: "include", pattern: "/ja" },
      ],
    });
    await runPreviewTimer();

    expect(screen.getByText("/blog/post-1")).toBeTruthy();
    expect(screen.getByText("/blog/drafts/one")).toBeTruthy();
    expect(screen.getAllByText("/pricing").length).toBeGreaterThan(0);
    expect(screen.getByText("/products/widget")).toBeTruthy();
    expect(screen.getAllByText("/ja").length).toBeGreaterThan(0);
    expect(screen.getByText("Excluded because include rules create an allowlist")).toBeTruthy();
    expect(screen.getAllByText("/blog/drafts/*").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inherited").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Direct").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Selected on this preview page").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 changed on this preview page").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Include page /blog/post-1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exclude section /blog" })).toBeTruthy();
    expect(screen.queryByText(/hreflang/i)).toBeNull();
  });

  it("searches backend preview rows and keeps ancestor folders visible", async () => {
    vi.useFakeTimers();
    const initialPreview = () =>
      new Response(
        JSON.stringify(
          makePreview({
            affectedPages: [
              {
                sourcePath: "/blog/post-1",
                selected: true,
                reason: "included_by_default",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
              },
              {
                sourcePath: "/blog/drafts/one",
                selected: false,
                reason: "excluded_by_rule",
                effectiveState: "excluded",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: true,
              },
              {
                sourcePath: "/products/widget",
                selected: true,
                reason: "included_by_default",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
              },
            ],
            pagination: { limit: 100, total: 200, hasMore: true, nextCursor: "page:/cursor" },
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(initialPreview())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makePreview({
              affectedPages: [
                {
                  sourcePath: "/blog/drafts/one",
                  selected: false,
                  reason: "excluded_by_rule",
                  effectiveState: "excluded",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: true,
                },
              ],
              pagination: { limit: 100, total: 3, hasMore: false },
              inventory: {
                knownPagesTotal: 3,
                resultNodesTotal: 3,
                resultMode: "search",
                summaryScope: "global_known_pages",
                resultScope: "filtered_tree_nodes",
                search: "drafts",
                maxPageSize: 200,
                complete: true,
              },
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(initialPreview()) as typeof fetch;

    renderManager();
    await runPreviewTimer();

    expect(screen.getByText("Searches globally across known backend source paths.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search source paths"), {
      target: { value: "drafts" },
    });
    await runPreviewTimer();

    expect(screen.getAllByText("/blog").length).toBeGreaterThan(0);
    expect(screen.getByText("/blog/drafts")).toBeTruthy();
    expect(screen.getByText("/blog/drafts/one")).toBeTruthy();
    expect(screen.getAllByText("1 changed on this preview page").length).toBeGreaterThan(1);
    expect(screen.queryByText("/blog/post-1")).toBeNull();
    expect(screen.queryByText("/products/widget")).toBeNull();
    expect(screen.getByText("1-3 of 3 previewed paths")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    await runPreviewTimer();
    expect(screen.getByText("/products/widget")).toBeTruthy();
  });

  it("shows inventory copy, rule change markers, and opens loaded folders", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as {
        sourceSelection: { rules: SourceSelectionRule[] };
      };
      return new Response(
        JSON.stringify(
          makePreview({
            sourceSelection: body.sourceSelection,
            affectedPages: [
              {
                sourcePath: "/blog/post-1",
                selected: true,
                reason: "included_by_default",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
              },
              {
                sourcePath: "/blog/drafts/one",
                selected: true,
                reason: "included_by_default",
                effectiveState: "included",
                previousSelected: true,
                previousReason: "included_by_default",
                changed: false,
              },
            ],
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as typeof fetch;

    renderManager({
      initialRules: [
        { action: "include", pattern: "/blog/*" },
        { action: "exclude", pattern: "/old/*" },
      ],
    });
    await runPreviewTimer();

    expect(screen.getByText("2/200 rules used")).toBeTruthy();
    expect(screen.getByText(/known discovered source paths/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open folder /blog" }));
    await runPreviewTimer();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("parentPath=%2Fblog"),
      expect.any(Object),
    );
    expect(screen.getAllByText("/blog").length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByLabelText("Pattern")[0] as HTMLInputElement, {
      target: { value: "/docs/*" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove rule 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Add exclude rule" }));
    const patternInputs = screen.getAllByLabelText("Pattern") as HTMLInputElement[];
    fireEvent.change(patternInputs[patternInputs.length - 1], {
      target: { value: "/products/*" },
    });

    expect(screen.getByText("Edited")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Removed on save")).toBeTruthy();
    expect(screen.getAllByText("/old/*").length).toBeGreaterThan(0);
  });

  it("disables adding rules when the draft reaches the frontend rule cap", () => {
    vi.useFakeTimers();
    const initialRules = Array.from({ length: 200 }, (_, index) => ({
      action: "include" as const,
      pattern: `/page-${index}`,
    }));

    renderManager({ initialRules });

    expect(screen.getByText("200/200 rules used")).toBeTruthy();
    expect(screen.getByText(/near the 200-rule limit/i)).toBeTruthy();
    expect(screen.getByText("Add include rule").closest("button")?.disabled).toBe(true);
    expect(screen.getByText("Add exclude rule").closest("button")?.disabled).toBe(true);
  });

  it("hides stale preview output when the current draft fails validation", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makePreview({
              affectedPages: [
                {
                  sourcePath: "/blog/post-1",
                  selected: true,
                  reason: "included_by_default",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                },
              ],
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            validationError(
              "sourceSelection.rules[0].pattern must use exact paths or /* wildcards",
            ),
          ),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        ),
      ) as typeof fetch;

    renderManager();
    await runPreviewTimer();
    expect(screen.getByText("/blog/post-1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/blog*" } });
    await runPreviewTimer();

    expect(screen.getByText("Rules need changes")).toBeTruthy();
    expect(screen.queryByText("/blog/post-1")).toBeNull();
    expect(screen.queryByText("Preview summary")).toBeNull();
    expect(
      (screen.getByRole("button", { name: /save source selection/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps pagination controls visible for an empty cursor preview page", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makePreview({
              affectedPages: [
                {
                  sourcePath: "/blog/post-1",
                  selected: true,
                  reason: "included_by_default",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                },
              ],
              pagination: {
                limit: 100,
                total: 100,
                hasMore: true,
                nextCursor: "page:/blog/post-1",
              },
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makePreview({
              affectedPages: [],
              nodes: [],
              pagination: { limit: 100, cursor: "page:/blog/post-1", total: 100, hasMore: false },
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as typeof fetch;

    renderManager();
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await runPreviewTimer();

    expect(screen.getByText("No known pages returned by preview.")).toBeTruthy();
    expect(screen.getByText("100-100 of 100 previewed paths")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("renders exclude-only behavior with unmatched pages included by default", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            makePreview({
              sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
              affectedPages: [
                {
                  sourcePath: "/about",
                  selected: true,
                  reason: "included_by_default",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                },
                {
                  sourcePath: "/products/widget",
                  selected: false,
                  reason: "excluded_by_rule",
                  effectiveState: "excluded",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: true,
                  matchedPattern: "/products/*",
                  matchedAction: "exclude",
                  ruleScope: "inherited",
                  inheritedRule: { action: "exclude", pattern: "/products/*" },
                  directRule: null,
                },
              ],
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;

    renderManager({ initialRules: [{ action: "exclude", pattern: "/products/*" }] });
    await runPreviewTimer();

    expect(screen.getByText("/about")).toBeTruthy();
    expect(screen.getByText("Included by default")).toBeTruthy();
    expect(screen.getByText("/products/widget")).toBeTruthy();
    expect(screen.getAllByText("Excluded by rule").length).toBeGreaterThan(0);
  });

  it.each([
    [
      "invalid pattern",
      "/blog*",
      validationError("sourceSelection.rules[0].pattern must use exact paths or /* wildcards"),
    ],
    [
      "duplicate pattern",
      "/blog/*",
      validationError(
        "sourceSelection.rules[1].pattern collides with another source-selection rule",
        "sourceSelection.rules[1].pattern",
      ),
    ],
    [
      "too many rules",
      "/page-201",
      validationError(
        "sourceSelection.rules must contain at most 200 rules",
        "sourceSelection.rules",
      ),
    ],
  ])(
    "shows %s validation and blocks save without discarding edits",
    async (_name, pattern, body) => {
      vi.useFakeTimers();
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
      ) as typeof fetch;
      const saveAction = vi.fn<SaveSourceSelectionAction>(async () => ({
        ok: true,
        message: "saved",
      }));

      renderManager({ saveAction });
      fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
      fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: pattern } });
      await runPreviewTimer();

      expect(screen.getByText("Rules need changes")).toBeTruthy();
      expect(screen.getAllByText(body.details.validation.message).length).toBeGreaterThan(0);
      expect(screen.getByDisplayValue(pattern)).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: /save source selection/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(saveAction).not.toHaveBeenCalled();
    },
  );

  it("ignores stale preview responses that resolve after a newer preview", async () => {
    vi.useFakeTimers();
    const first = createDeferred<Response>();
    const second = createDeferred<Response>();
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise) as typeof fetch;

    renderManager();
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add exclude rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/products/*" } });
    await runPreviewTimer();

    await act(async () => {
      second.resolve(
        new Response(
          JSON.stringify(
            makePreview({
              sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
              affectedPages: [
                {
                  sourcePath: "/products/widget",
                  selected: false,
                  reason: "excluded_by_rule",
                  effectiveState: "excluded",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: true,
                  matchedPattern: "/products/*",
                  matchedAction: "exclude",
                },
              ],
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("/products/widget")).toBeTruthy();

    await act(async () => {
      first.resolve(
        new Response(
          JSON.stringify(
            makePreview({
              affectedPages: [
                {
                  sourcePath: "/blog/post-1",
                  selected: true,
                  reason: "included_by_default",
                  effectiveState: "included",
                  previousSelected: true,
                  previousReason: "included_by_default",
                  changed: false,
                },
              ],
            }),
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("/products/widget")).toBeTruthy();
    expect(screen.queryByText("/blog/post-1")).toBeNull();
  });
});
