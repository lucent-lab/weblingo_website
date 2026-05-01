// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionResponse } from "@/app/dashboard/actions";
import type {
  SourceSelectionPreviewResponse,
  SourceSelectionRule,
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

function makePreview(
  overrides: Partial<SourceSelectionPreviewResponse> = {},
): SourceSelectionPreviewResponse {
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
  return {
    sourceSelection: overrides.sourceSelection ?? { rules: [] },
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
    affectedPages,
    pagination: overrides.pagination ?? {
      limit: 100,
      offset: 0,
      total: affectedPages.length,
      hasMore: false,
    },
    warnings: overrides.warnings ?? [],
  };
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

    renderManager({ saveAction });
    await runPreviewTimer();

    fireEvent.click(screen.getByRole("button", { name: "Add include rule" }));
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "/blog/*" } });
    await runPreviewTimer();

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/api/dashboard/sites/site-1/source-selection/preview"),
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
                } as SourceSelectionPreviewResponse["affectedPages"][number] & {
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
    expect(screen.getByRole("button", { name: "Include page /blog/post-1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exclude section /blog" })).toBeTruthy();
    expect(screen.queryByText(/hreflang/i)).toBeNull();
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

  it("keeps pagination controls visible for an empty nonzero-offset preview page", async () => {
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
              pagination: { limit: 100, offset: 0, total: 100, hasMore: true },
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
              pagination: { limit: 100, offset: 100, total: 100, hasMore: false },
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
