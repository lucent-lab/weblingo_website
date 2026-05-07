"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FolderTree,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { ActionResponse } from "@/app/dashboard/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  SourceSelectionConfig,
  SourceSelectionPreviewReason,
  SourceSelectionRule,
  SourceSelectionTreePreviewNode,
  SourceSelectionTreePreviewResponse,
} from "@internal/dashboard/webhooks";

import {
  addOrReplaceRule,
  createDraftRule,
  descendantPatternForPath,
  normalizeRulesForForm,
  removeRulesByPattern,
  sourceSelectionFingerprint,
  toSourceSelectionConfig,
  type DraftSourceSelectionRule,
  type EditableSourceSelectionAction,
} from "./source-selection-model";

const PREVIEW_DEBOUNCE_MS = 350;
const PREVIEW_PAGE_SIZE = 100;
const PREVIEW_CACHE_LIMIT = 30;
const SOURCE_SELECTION_MIN_SEARCH_LENGTH = 3;
const SOURCE_SELECTION_RULE_LIMIT = 200;
const SOURCE_SELECTION_RULE_LIMIT_WARNING_THRESHOLD = 180;

export type SourceSelectionCopy = {
  title: string;
  description: string;
  persistedTitle: string;
  persistedDescription: string;
  proposedTitle: string;
  proposedDescription: string;
  noRules: string;
  unsavedChanges: string;
  inSync: string;
  actionLabel: string;
  patternLabel: string;
  patternPlaceholder: string;
  includeAction: string;
  excludeAction: string;
  addIncludeRule: string;
  addExcludeRule: string;
  removeRule: string;
  ruleLimitLabel: string;
  ruleLimitHelp: string;
  ruleLimitNear: string;
  ruleChangeNew: string;
  ruleChangeEdited: string;
  ruleChangeRemoved: string;
  summaryTitle: string;
  summaryDescription: string;
  knownIncluded: string;
  knownExcluded: string;
  includedByDefault: string;
  includedByRule: string;
  excludedByRule: string;
  notIncludedByRule: string;
  rulesTotal: string;
  warningsTitle: string;
  impactTitle: string;
  selectedToExcludedWarning: string;
  activeSiteRerunWarning: string;
  validationTitle: string;
  previewErrorTitle: string;
  previewLoading: string;
  previewReady: string;
  previewBlocked: string;
  preview: string;
  pagesTitle: string;
  pagesDescription: string;
  pagesEmpty: string;
  filterLabel: string;
  filterPlaceholder: string;
  filterHelp: string;
  filterMinLength: string;
  filterNoResults: string;
  clearFilter: string;
  inventoryNote: string;
  partialInventoryNote: string;
  currentFolder: string;
  parentFolder: string;
  rootFolder: string;
  openFolder: string;
  pageColumn: string;
  stateColumn: string;
  reasonColumn: string;
  actionsColumn: string;
  selected: string;
  selectedOnPage: string;
  excluded: string;
  mixed: string;
  defaultState: string;
  direct: string;
  inherited: string;
  changed: string;
  changedOnPage: string;
  matchedPattern: string;
  noMatchedPattern: string;
  includePage: string;
  excludePage: string;
  inheritPage: string;
  includeDescendants: string;
  excludeDescendants: string;
  inheritDescendants: string;
  descendantsHelp: string;
  exactHelp: string;
  previousPage: string;
  nextPage: string;
  paginationLabel: string;
  save: string;
  saving: string;
  saveDisabled: string;
  saved: string;
  reset: string;
  reasonLabels: Record<SourceSelectionPreviewReason, string>;
};

type SourceSelectionManagerProps = {
  siteId: string;
  initialRules: SourceSelectionRule[];
  routeConfigUpdatedAt?: string | null;
  sourceSelectionFingerprint?: string | null;
  canEdit: boolean;
  saveAction: (
    prevState: ActionResponse | undefined,
    formData: FormData,
  ) => Promise<ActionResponse>;
  copy: SourceSelectionCopy;
};

type PreviewError = {
  message: string;
  validation: Array<{ field?: string; message: string }>;
};

type SourceSelectionFolderNode = SourceSelectionTreePreviewNode & { kind: "folder" };
type SourceSelectionPageNode = SourceSelectionTreePreviewNode & { kind: "page" };

export function SourceSelectionManager({
  siteId,
  initialRules,
  routeConfigUpdatedAt,
  sourceSelectionFingerprint: backendSourceSelectionFingerprint,
  canEdit,
  saveAction,
  copy,
}: SourceSelectionManagerProps) {
  const initialDraftRules = useMemo(() => normalizeRulesForForm(initialRules), [initialRules]);
  const [persistedRules, setPersistedRules] =
    useState<DraftSourceSelectionRule[]>(initialDraftRules);
  const [draftRules, setDraftRules] = useState<DraftSourceSelectionRule[]>(initialDraftRules);
  const [preview, setPreview] = useState<SourceSelectionTreePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<PreviewError | null>(null);
  const [isPreviewLoading, setPreviewLoading] = useState(false);
  const [previewRequestKey, setPreviewRequestKey] = useState(0);
  const [lastSuccessfulPreviewFingerprint, setLastSuccessfulPreviewFingerprint] = useState("");
  const [parentPath, setParentPath] = useState("/");
  const [pathSearch, setPathSearch] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [expectedRouteConfigUpdatedAt, setExpectedRouteConfigUpdatedAt] = useState(
    routeConfigUpdatedAt ?? null,
  );
  const [expectedSourceSelectionFingerprint, setExpectedSourceSelectionFingerprint] = useState(
    backendSourceSelectionFingerprint ?? null,
  );
  const [saveResult, setSaveResult] = useState<ActionResponse | null>(null);
  const [isSaving, setSaving] = useState(false);
  const requestIdRef = useRef(0);
  const draftFingerprintRef = useRef("");
  const previewCacheRef = useRef(new Map<string, SourceSelectionTreePreviewResponse>());

  const draftConfig = useMemo(() => toSourceSelectionConfig(draftRules), [draftRules]);
  const persistedConfig = useMemo(() => toSourceSelectionConfig(persistedRules), [persistedRules]);
  const draftFingerprint = useMemo(() => sourceSelectionFingerprint(draftConfig), [draftConfig]);
  const persistedFingerprint = useMemo(
    () => sourceSelectionFingerprint(persistedConfig),
    [persistedConfig],
  );
  const hasUnsavedChanges = draftFingerprint !== persistedFingerprint;
  const previewIsCurrent = lastSuccessfulPreviewFingerprint === draftFingerprint;
  const controlsCanEdit = canEdit && !isSaving;
  const canSave =
    canEdit &&
    hasUnsavedChanges &&
    preview !== null &&
    previewIsCurrent &&
    previewError === null &&
    !isPreviewLoading &&
    !isSaving;

  useEffect(() => {
    draftFingerprintRef.current = draftFingerprint;
  }, [draftFingerprint]);

  const requestPreview = useCallback(() => {
    setPreviewRequestKey((current) => current + 1);
  }, []);
  const updateDraftRules = useCallback(
    (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => {
      setDraftRules((current) => updater(current));
      setCursorStack([]);
      setSaveResult(null);
      requestPreview();
    },
    [requestPreview],
  );
  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const trimmedPathSearch = pathSearch.trim();
  const hasPathSearch = trimmedPathSearch.length > 0;
  const pathSearchTooShort =
    hasPathSearch && trimmedPathSearch.length < SOURCE_SELECTION_MIN_SEARCH_LENGTH;
  const previewShell = previewIsCurrent && !previewError ? preview : null;
  const currentPreview = previewShell && !pathSearchTooShort ? previewShell : null;
  const previewCacheKey = useMemo(
    () =>
      JSON.stringify({
        siteId,
        draftFingerprint,
        cursor: currentCursor,
        search: hasPathSearch ? trimmedPathSearch : null,
        parentPath: hasPathSearch ? null : parentPath,
        limit: PREVIEW_PAGE_SIZE,
      }),
    [currentCursor, draftFingerprint, hasPathSearch, parentPath, siteId, trimmedPathSearch],
  );

  useEffect(() => {
    if (!canEdit || previewRequestKey === 0) {
      return;
    }
    if (pathSearchTooShort) {
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    const cachedPreview = previewCacheRef.current.get(previewCacheKey);
    if (cachedPreview) {
      setPreview(cachedPreview);
      setPreviewError(null);
      setLastSuccessfulPreviewFingerprint(draftFingerprint);
      setPreviewLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      void (async () => {
        try {
          const params = new URLSearchParams({
            limit: String(PREVIEW_PAGE_SIZE),
          });
          if (currentCursor) {
            params.set("cursor", currentCursor);
          }
          if (hasPathSearch) {
            params.set("search", trimmedPathSearch);
          } else {
            params.set("parentPath", parentPath);
          }
          const response = await fetch(
            `/api/dashboard/sites/${encodeURIComponent(siteId)}/source-selection/tree-preview?${params.toString()}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceSelection: draftConfig,
                includeUnknownFutureDescendants: true,
              }),
              cache: "no-store",
              signal: controller.signal,
            },
          );
          const body = (await response.json()) as unknown;
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (!response.ok) {
            setPreviewError(extractPreviewError(body, response.status));
            setPreviewLoading(false);
            return;
          }
          const parsedPreview = body as SourceSelectionTreePreviewResponse;
          rememberPreview(previewCacheRef.current, previewCacheKey, parsedPreview);
          setPreview(parsedPreview);
          setPreviewError(null);
          setLastSuccessfulPreviewFingerprint(draftFingerprint);
          setPreviewLoading(false);
        } catch (error) {
          if (controller.signal.aborted || requestId !== requestIdRef.current) {
            return;
          }
          setPreviewError({
            message: error instanceof Error ? error.message : copy.previewErrorTitle,
            validation: [],
          });
          setPreviewLoading(false);
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    canEdit,
    copy.previewErrorTitle,
    currentCursor,
    draftConfig,
    draftFingerprint,
    hasPathSearch,
    parentPath,
    pathSearchTooShort,
    previewCacheKey,
    previewRequestKey,
    siteId,
    trimmedPathSearch,
  ]);

  const savePreview = () => {
    if (!canSave || !preview) {
      return;
    }
    const saveConfig = draftConfig;
    const saveFingerprint = draftFingerprint;
    setSaving(true);
    void (async () => {
      const formData = new FormData();
      formData.set("siteId", siteId);
      formData.set("sourceSelection", JSON.stringify(saveConfig));
      if (expectedRouteConfigUpdatedAt) {
        formData.set("expectedRouteConfigUpdatedAt", expectedRouteConfigUpdatedAt);
      }
      formData.set(
        "expectedSourceSelectionFingerprint",
        expectedSourceSelectionFingerprint ?? persistedFingerprint,
      );
      try {
        const result = await saveAction(undefined, formData);
        setSaveResult(result);
        if (!result.ok) {
          return;
        }
        const savedConfig = readSavedSourceSelection(result.meta) ?? saveConfig;
        const savedTokens = readSavedRouteTokens(result.meta);
        const savedRules = normalizeRulesForForm(savedConfig.rules);
        setPersistedRules(savedRules);
        setExpectedRouteConfigUpdatedAt(
          savedTokens.routeConfigUpdatedAt ?? expectedRouteConfigUpdatedAt,
        );
        setExpectedSourceSelectionFingerprint(
          savedTokens.sourceSelectionFingerprint ?? sourceSelectionFingerprint(savedConfig),
        );
        if (draftFingerprintRef.current === saveFingerprint) {
          setDraftRules(savedRules);
          setLastSuccessfulPreviewFingerprint(sourceSelectionFingerprint(savedConfig));
        }
      } catch (error) {
        setSaveResult({
          ok: false,
          message: error instanceof Error ? error.message : copy.previewErrorTitle,
        });
      } finally {
        setSaving(false);
      }
    })();
  };

  const resetDraft = () => {
    setDraftRules(persistedRules);
    setCursorStack([]);
    setSaveResult(null);
  };

  const visibleTreeRows = currentPreview?.nodes ?? [];
  const openFolder = useCallback(
    (path: string) => {
      setParentPath(path);
      setPathSearch("");
      setCursorStack([]);
      requestPreview();
    },
    [requestPreview],
  );
  const openParentFolder = useCallback(() => {
    setParentPath(parentSourcePath(parentPath));
    setCursorStack([]);
    requestPreview();
  }, [parentPath, requestPreview]);
  const updatePathSearch = useCallback(
    (value: string) => {
      setPathSearch(value);
      setCursorStack([]);
      requestPreview();
    },
    [requestPreview],
  );

  const pagination = currentPreview?.pagination ?? null;
  const paginationStart =
    currentPreview && currentPreview.pagination.total > 0
      ? Math.min(cursorStack.length * PREVIEW_PAGE_SIZE + 1, currentPreview.pagination.total)
      : 0;
  const paginationEnd = currentPreview
    ? currentPreview.nodes.length > 0
      ? Math.min(paginationStart + currentPreview.nodes.length - 1, currentPreview.pagination.total)
      : paginationStart
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
          <Badge variant={hasUnsavedChanges ? "outline" : "secondary"}>
            {hasUnsavedChanges ? copy.unsavedChanges : copy.inSync}
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.persistedTitle}</CardTitle>
            <CardDescription>{copy.persistedDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <RulesList rules={persistedRules} emptyLabel={copy.noRules} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.proposedTitle}</CardTitle>
            <CardDescription>{copy.proposedDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RuleEditor
              canEdit={controlsCanEdit}
              copy={copy}
              persistedRules={persistedRules}
              rules={draftRules}
              onChange={updateDraftRules}
            />
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <PreviewStatus
                copy={copy}
                isLoading={isPreviewLoading}
                isCurrent={previewIsCurrent}
                error={previewError}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestPreview}
                  disabled={isPreviewLoading || isSaving}
                >
                  {copy.preview}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetDraft}
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  {copy.reset}
                </Button>
                <Button
                  type="button"
                  onClick={savePreview}
                  disabled={!canSave}
                  title={canSave ? copy.save : copy.saveDisabled}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSaving ? copy.saving : copy.save}
                </Button>
              </div>
            </div>
            {saveResult ? (
              <p
                className={cn("text-sm", saveResult.ok ? "text-emerald-700" : "text-destructive")}
                role={saveResult.ok ? "status" : "alert"}
              >
                {saveResult.message || (saveResult.ok ? copy.saved : copy.previewErrorTitle)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {previewError ? <ValidationAlert copy={copy} error={previewError} /> : null}
      {currentPreview?.warnings.length ? (
        <WarningsAlert copy={copy} preview={currentPreview} />
      ) : null}
      {currentPreview ? <ImpactAlert copy={copy} preview={currentPreview} /> : null}
      {currentPreview ? <PreviewSummary copy={copy} preview={currentPreview} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{copy.pagesTitle}</CardTitle>
          <CardDescription>{copy.pagesDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPreviewLoading && !currentPreview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.previewLoading}
            </div>
          ) : (
            <div className="space-y-4">
              {previewShell ? (
                <div className="rounded-md border border-border/60 bg-muted/10 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Field
                      className="min-w-0 flex-1"
                      label={copy.filterLabel}
                      htmlFor="source-selection-path-filter"
                      description={copy.filterHelp}
                    >
                      <Input
                        id="source-selection-path-filter"
                        value={pathSearch}
                        placeholder={copy.filterPlaceholder}
                        minLength={SOURCE_SELECTION_MIN_SEARCH_LENGTH}
                        onChange={(event) => updatePathSearch(event.target.value)}
                      />
                      {pathSearchTooShort ? (
                        <p className="text-xs text-muted-foreground" role="status">
                          {copy.filterMinLength.replace(
                            "{count}",
                            String(SOURCE_SELECTION_MIN_SEARCH_LENGTH),
                          )}
                        </p>
                      ) : null}
                    </Field>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!hasPathSearch}
                      onClick={() => updatePathSearch("")}
                    >
                      {copy.clearFilter}
                    </Button>
                    {!hasPathSearch ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{copy.currentFolder}</span>
                        <Badge variant="secondary" className="font-mono">
                          {parentPath === "/" ? copy.rootFolder : parentPath}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={parentPath === "/" || isPreviewLoading}
                          onClick={openParentFolder}
                        >
                          {copy.parentFolder}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {currentPreview ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {currentPreview.inventory.complete
                        ? copy.inventoryNote
                        : copy.partialInventoryNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {visibleTreeRows.length === 0 ? (
                !pathSearchTooShort ? (
                  <p className="text-sm text-muted-foreground">
                    {hasPathSearch ? copy.filterNoResults : copy.pagesEmpty}
                  </p>
                ) : null
              ) : (
                <SourceSelectionTree
                  canEdit={controlsCanEdit}
                  copy={copy}
                  rows={visibleTreeRows}
                  onOpenFolder={openFolder}
                  onChange={updateDraftRules}
                />
              )}
              {currentPreview && pagination ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {copy.paginationLabel
                      .replace("{start}", String(paginationStart))
                      .replace("{end}", String(paginationEnd))
                      .replace("{total}", String(pagination.total))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={cursorStack.length === 0 || isPreviewLoading}
                      onClick={() => {
                        setCursorStack((current) => current.slice(0, -1));
                        requestPreview();
                      }}
                    >
                      {copy.previousPage}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!pagination.hasMore || isPreviewLoading}
                      onClick={() => {
                        setCursorStack((current) =>
                          pagination.nextCursor ? [...current, pagination.nextCursor] : current,
                        );
                        requestPreview();
                      }}
                    >
                      {copy.nextPage}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function rememberPreview(
  cache: Map<string, SourceSelectionTreePreviewResponse>,
  key: string,
  preview: SourceSelectionTreePreviewResponse,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, preview);
  while (cache.size > PREVIEW_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") {
      return;
    }
    cache.delete(oldestKey);
  }
}

function RulesList({
  rules,
  emptyLabel,
}: {
  rules: readonly DraftSourceSelectionRule[];
  emptyLabel: string;
}) {
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="grid grid-cols-[6rem_1fr] items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
        >
          <Badge variant={rule.action === "include" ? "secondary" : "outline"}>{rule.action}</Badge>
          <span className="break-all font-mono text-xs text-foreground">{rule.pattern}</span>
        </div>
      ))}
    </div>
  );
}

function RuleEditor({
  canEdit,
  copy,
  persistedRules,
  rules,
  onChange,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  persistedRules: DraftSourceSelectionRule[];
  rules: DraftSourceSelectionRule[];
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
}) {
  const addRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => [...current, createDraftRule(action, "")]);
  };
  const removedRules = useMemo(
    () =>
      persistedRules.filter((persistedRule) =>
        rules.every(
          (draftRule) => draftRule.id !== persistedRule.id && !rulesMatch(draftRule, persistedRule),
        ),
      ),
    [persistedRules, rules],
  );
  const atRuleLimit = rules.length >= SOURCE_SELECTION_RULE_LIMIT;
  const nearRuleLimit = rules.length >= SOURCE_SELECTION_RULE_LIMIT_WARNING_THRESHOLD;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          {copy.ruleLimitLabel
            .replace("{count}", String(rules.length))
            .replace("{limit}", String(SOURCE_SELECTION_RULE_LIMIT))}
        </span>
        <span className={cn("text-xs", nearRuleLimit ? "text-amber-700" : "text-muted-foreground")}>
          {nearRuleLimit ? copy.ruleLimitNear : copy.ruleLimitHelp}
        </span>
      </div>
      {rules.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noRules}</p> : null}
      {rules.map((rule, index) => {
        const actionId = `source-selection-action-${rule.id}`;
        const patternId = `source-selection-pattern-${rule.id}`;
        const changeState = getRuleChangeState(rule, persistedRules);
        return (
          <div
            key={rule.id}
            className="grid gap-3 rounded-md border border-border/60 bg-background p-3 md:grid-cols-[9rem_1fr_auto]"
          >
            <Field label={copy.actionLabel} htmlFor={actionId}>
              <select
                id={actionId}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={rule.action}
                disabled={!canEdit}
                onChange={(event) => {
                  const value = event.target.value as EditableSourceSelectionAction;
                  onChange((current) =>
                    current.map((entry) =>
                      entry.id === rule.id ? { ...entry, action: value } : entry,
                    ),
                  );
                }}
              >
                <option value="include">{copy.includeAction}</option>
                <option value="exclude">{copy.excludeAction}</option>
              </select>
            </Field>
            <Field label={copy.patternLabel} htmlFor={patternId}>
              <Input
                id={patternId}
                value={rule.pattern}
                placeholder={copy.patternPlaceholder}
                disabled={!canEdit}
                onChange={(event) => {
                  const value = event.target.value;
                  onChange((current) =>
                    current.map((entry) =>
                      entry.id === rule.id ? { ...entry, pattern: value } : entry,
                    ),
                  );
                }}
              />
              {changeState ? (
                <Badge className="mt-2 w-fit" variant="outline">
                  {changeState === "new" ? copy.ruleChangeNew : copy.ruleChangeEdited}
                </Badge>
              ) : null}
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={!canEdit}
                aria-label={`${copy.removeRule} ${index + 1}`}
                title={copy.removeRule}
                onClick={() =>
                  onChange((current) => current.filter((entry) => entry.id !== rule.id))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      {removedRules.length ? (
        <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-3">
          {removedRules.map((rule) => (
            <div key={`removed-${rule.id}`} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{copy.ruleChangeRemoved}</Badge>
              <Badge variant={rule.action === "include" ? "secondary" : "outline"}>
                {rule.action}
              </Badge>
              <span className="break-all font-mono text-xs text-muted-foreground">
                {rule.pattern}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit || atRuleLimit}
          onClick={() => addRule("include")}
        >
          <Plus className="mr-2 h-4 w-4" />
          {copy.addIncludeRule}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit || atRuleLimit}
          onClick={() => addRule("exclude")}
        >
          <Plus className="mr-2 h-4 w-4" />
          {copy.addExcludeRule}
        </Button>
      </div>
    </div>
  );
}

function PreviewStatus({
  copy,
  error,
  isCurrent,
  isLoading,
}: {
  copy: SourceSelectionCopy;
  error: PreviewError | null;
  isCurrent: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {copy.previewLoading}
      </p>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">{copy.previewBlocked}</p>;
  }
  if (isCurrent) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700" role="status">
        <CheckCircle2 className="h-4 w-4" />
        {copy.previewReady}
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">{copy.saveDisabled}</p>;
}

function ValidationAlert({ copy, error }: { copy: SourceSelectionCopy; error: PreviewError }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{copy.validationTitle}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{error.message}</p>
          {error.validation.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {error.validation.map((item, index) => (
                <li key={`${item.field ?? "field"}-${index}`}>
                  {item.field ? <span className="font-mono">{item.field}: </span> : null}
                  {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function WarningsAlert({
  copy,
  preview,
}: {
  copy: SourceSelectionCopy;
  preview: SourceSelectionTreePreviewResponse;
}) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{copy.warningsTitle}</AlertTitle>
      <AlertDescription>
        <ul className="space-y-2">
          {preview.warnings.map((warning, index) => (
            <li key={`${warning.code}:${warning.message}:${index}`}>
              <span className="font-medium">{warning.message}</span>
              {typeof warning.count === "number" ? (
                <span className="ml-1 text-amber-800">({warning.count})</span>
              ) : null}
              {warning.sourcePaths?.length ? (
                <div className="mt-1 text-xs font-mono text-amber-900">
                  {warning.sourcePaths.join(", ")}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function ImpactAlert({
  copy,
  preview,
}: {
  copy: SourceSelectionCopy;
  preview: SourceSelectionTreePreviewResponse;
}) {
  const selectedToExcluded = preview.impact.selectedToExcluded;
  const activeSiteRerun = preview.impact.activeSiteRerun;
  if (selectedToExcluded.count === 0 && !activeSiteRerun.required) {
    return null;
  }

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{copy.impactTitle}</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          {selectedToExcluded.count > 0 ? (
            <div>
              <p>
                {copy.selectedToExcludedWarning.replace(
                  "{count}",
                  String(selectedToExcluded.count),
                )}
              </p>
              {selectedToExcluded.sourcePaths.length ? (
                <p className="mt-1 break-all font-mono text-xs text-amber-900">
                  {selectedToExcluded.sourcePaths.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {activeSiteRerun.required ? (
            <p>
              {copy.activeSiteRerunWarning.replace(
                "{count}",
                String(activeSiteRerun.activeDeploymentCount),
              )}
            </p>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function PreviewSummary({
  copy,
  preview,
}: {
  copy: SourceSelectionCopy;
  preview: SourceSelectionTreePreviewResponse;
}) {
  const items = [
    { key: "knownIncluded", label: copy.knownIncluded, value: preview.summary.knownPagesIncluded },
    { key: "knownExcluded", label: copy.knownExcluded, value: preview.summary.knownPagesExcluded },
    {
      key: "includedByDefault",
      label: copy.includedByDefault,
      value: preview.summary.includedByDefault,
    },
    { key: "includedByRule", label: copy.includedByRule, value: preview.summary.includedByRule },
    { key: "excludedByRule", label: copy.excludedByRule, value: preview.summary.excludedByRule },
    {
      key: "notIncludedByRule",
      label: copy.notIncludedByRule,
      value: preview.summary.notIncludedByRule,
    },
    { key: "rulesTotal", label: copy.rulesTotal, value: preview.summary.rulesTotal },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.summaryTitle}</CardTitle>
        <CardDescription>
          {preview.inventory.complete ? copy.summaryDescription : copy.partialInventoryNote}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.key} className="rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
            <p className="font-mono text-2xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SourceSelectionTree({
  canEdit,
  copy,
  rows,
  onOpenFolder,
  onChange,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  rows: SourceSelectionTreePreviewNode[];
  onOpenFolder: (path: string) => void;
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
}) {
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const activeFocusedRowId =
    focusedRowId && rowIds.includes(focusedRowId) ? focusedRowId : (rowIds[0] ?? "");

  const setRowRef = useCallback((id: string, node: HTMLTableRowElement | null) => {
    if (node) {
      rowRefs.current.set(id, node);
      return;
    }
    rowRefs.current.delete(id);
  }, []);

  const focusRow = useCallback(
    (index: number) => {
      const nextRow = rows[index];
      if (!nextRow) {
        return;
      }
      setFocusedRowId(nextRow.id);
      rowRefs.current.get(nextRow.id)?.focus();
    },
    [rows],
  );

  const handleRowKeyDown = useCallback(
    (row: SourceSelectionTreePreviewNode, event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      const currentIndex = rows.findIndex((candidate) => candidate.id === row.id);
      if (currentIndex < 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusRow(Math.min(currentIndex + 1, rows.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusRow(Math.max(currentIndex - 1, 0));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusRow(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        focusRow(rows.length - 1);
        return;
      }
      if (event.key === "ArrowLeft") {
        const parentIndex = findPreviousAncestorRowIndex(rows, currentIndex, row.depth);
        if (parentIndex >= 0) {
          event.preventDefault();
          focusRow(parentIndex);
        }
        return;
      }
      if (
        (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") &&
        row.kind === "folder" &&
        row.hasChildren
      ) {
        event.preventDefault();
        onOpenFolder(row.sourcePath);
      }
    },
    [focusRow, onOpenFolder, rows],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table
        role="treegrid"
        aria-label={copy.pagesTitle}
        aria-colcount={4}
        aria-rowcount={rows.length + 1}
        className="w-full min-w-[760px] text-sm"
      >
        <thead role="rowgroup" className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr role="row">
            <th role="columnheader" scope="col" className="px-3 py-2 text-left">
              {copy.pageColumn}
            </th>
            <th role="columnheader" scope="col" className="px-3 py-2 text-left">
              {copy.stateColumn}
            </th>
            <th role="columnheader" scope="col" className="px-3 py-2 text-left">
              {copy.reasonColumn}
            </th>
            <th role="columnheader" scope="col" className="px-3 py-2 text-right">
              {copy.actionsColumn}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row, index) =>
            row.kind === "folder" ? (
              <FolderRow
                key={row.id}
                canEdit={canEdit}
                copy={copy}
                isFocused={activeFocusedRowId === row.id}
                row={row as SourceSelectionFolderNode}
                rowIndex={index}
                setRowRef={setRowRef}
                onChange={onChange}
                onFocusRow={setFocusedRowId}
                onOpen={onOpenFolder}
                onRowKeyDown={handleRowKeyDown}
              />
            ) : (
              <PageRow
                key={row.id}
                canEdit={canEdit}
                copy={copy}
                isFocused={activeFocusedRowId === row.id}
                row={row as SourceSelectionPageNode}
                rowIndex={index}
                setRowRef={setRowRef}
                onChange={onChange}
                onFocusRow={setFocusedRowId}
                onRowKeyDown={handleRowKeyDown}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FolderRow({
  canEdit,
  copy,
  isFocused,
  onChange,
  onFocusRow,
  onOpen,
  onRowKeyDown,
  row,
  rowIndex,
  setRowRef,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  isFocused: boolean;
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
  onFocusRow: (id: string) => void;
  onOpen: (path: string) => void;
  onRowKeyDown: (
    row: SourceSelectionTreePreviewNode,
    event: KeyboardEvent<HTMLTableRowElement>,
  ) => void;
  row: SourceSelectionFolderNode;
  rowIndex: number;
  setRowRef: (id: string, node: HTMLTableRowElement | null) => void;
}) {
  const descendantPattern = descendantPatternForPath(row.sourcePath);
  const descendantRuleAction =
    row.descendantRule?.action === "include" || row.descendantRule?.action === "exclude"
      ? row.descendantRule.action
      : null;
  const setDescendantRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => addOrReplaceRule(current, { action, pattern: descendantPattern }));
  };
  const clearDescendantRule = () => {
    onChange((current) => removeRulesByPattern(current, descendantPattern));
  };

  return (
    <tr
      {...treeRowProps({
        copy,
        isFocused,
        onFocusRow,
        onRowKeyDown,
        row,
        rowIndex,
        setRowRef,
      })}
      className="border-t border-border/50 bg-muted/10 outline-none focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <td role="gridcell" className="px-3 py-3 align-top">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 1.1}rem` }}>
          {row.hasChildren ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              aria-label={`${copy.openFolder} ${row.sourcePath}`}
              aria-keyshortcuts="ArrowRight Enter"
              title={copy.openFolder}
              onClick={() => onOpen(row.sourcePath)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <span className="h-7 w-7 shrink-0" aria-hidden="true" />
          )}
          <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="break-all font-mono text-xs text-foreground">{row.sourcePath}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{copy.descendantsHelp}</p>
      </td>
      <td role="gridcell" className="px-3 py-3 align-top">
        <StateBadge copy={copy} state={toBadgeState(row.effectiveState)} />
      </td>
      <td role="gridcell" className="px-3 py-3 align-top text-muted-foreground">
        <span className="font-mono text-xs">
          {row.knownPagesIncluded}/{row.knownPagesTotal}
        </span>{" "}
        {copy.selectedOnPage}
        {descendantRuleAction ? (
          <div className="mt-1">
            <Badge variant="outline">{copy.direct}</Badge>
          </div>
        ) : null}
        {row.changedKnownPages > 0 ? (
          <div className="mt-1">
            <Badge variant="outline">
              {copy.changedOnPage.replace("{count}", String(row.changedKnownPages))}
            </Badge>
          </div>
        ) : null}
      </td>
      <td role="gridcell" className="px-3 py-3 text-right align-top">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${copy.includeDescendants} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={() => setDescendantRule("include")}
          >
            {copy.includeDescendants}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${copy.excludeDescendants} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={() => setDescendantRule("exclude")}
          >
            {copy.excludeDescendants}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`${copy.inheritDescendants} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={clearDescendantRule}
          >
            {copy.inheritDescendants}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function PageRow({
  canEdit,
  copy,
  isFocused,
  onChange,
  onFocusRow,
  onRowKeyDown,
  row,
  rowIndex,
  setRowRef,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  isFocused: boolean;
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
  onFocusRow: (id: string) => void;
  onRowKeyDown: (
    row: SourceSelectionTreePreviewNode,
    event: KeyboardEvent<HTMLTableRowElement>,
  ) => void;
  row: SourceSelectionPageNode;
  rowIndex: number;
  setRowRef: (id: string, node: HTMLTableRowElement | null) => void;
}) {
  const state = toBadgeState(row.effectiveState);
  const setPageRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => addOrReplaceRule(current, { action, pattern: row.sourcePath }));
  };
  const clearPageRule = () => {
    onChange((current) => removeRulesByPattern(current, row.sourcePath));
  };

  return (
    <tr
      {...treeRowProps({
        copy,
        isFocused,
        onFocusRow,
        onRowKeyDown,
        row,
        rowIndex,
        setRowRef,
      })}
      className="border-t border-border/50 outline-none focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <td role="gridcell" className="px-3 py-3 align-top">
        <div style={{ paddingLeft: `${row.depth * 1.1}rem` }}>
          <span className="break-all rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
            {row.sourcePath}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{copy.exactHelp}</p>
      </td>
      <td role="gridcell" className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge copy={copy} state={state} />
          {row.changed ? <Badge variant="outline">{copy.changed}</Badge> : null}
        </div>
      </td>
      <td role="gridcell" className="px-3 py-3 align-top">
        <div className="space-y-1 text-muted-foreground">
          <p>{row.reason ? copy.reasonLabels[row.reason] : copy.defaultState}</p>
          <p className="text-xs">
            {row.matchedPattern ? (
              <>
                {copy.matchedPattern}{" "}
                <span className="font-mono text-foreground">{row.matchedPattern}</span>
              </>
            ) : (
              copy.noMatchedPattern
            )}
          </p>
          <div className="flex flex-wrap gap-1">
            {row.directRule ? <Badge variant="outline">{copy.direct}</Badge> : null}
            {row.inheritedRule || row.ruleScope === "inherited" ? (
              <Badge variant="secondary">{copy.inherited}</Badge>
            ) : null}
            {!row.directRule && !row.inheritedRule && !row.matchedPattern ? (
              <Badge variant="outline">{copy.defaultState}</Badge>
            ) : null}
          </div>
        </div>
      </td>
      <td role="gridcell" className="px-3 py-3 text-right align-top">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${copy.includePage} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={() => setPageRule("include")}
          >
            {copy.includePage}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${copy.excludePage} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={() => setPageRule("exclude")}
          >
            {copy.excludePage}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`${copy.inheritPage} ${row.sourcePath}`}
            disabled={!canEdit}
            onClick={clearPageRule}
          >
            {copy.inheritPage}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function treeRowProps({
  copy,
  isFocused,
  onFocusRow,
  onRowKeyDown,
  row,
  rowIndex,
  setRowRef,
}: {
  copy: SourceSelectionCopy;
  isFocused: boolean;
  onFocusRow: (id: string) => void;
  onRowKeyDown: (
    row: SourceSelectionTreePreviewNode,
    event: KeyboardEvent<HTMLTableRowElement>,
  ) => void;
  row: SourceSelectionTreePreviewNode;
  rowIndex: number;
  setRowRef: (id: string, node: HTMLTableRowElement | null) => void;
}) {
  return {
    ref: (node: HTMLTableRowElement | null) => setRowRef(row.id, node),
    role: "row" as const,
    tabIndex: isFocused ? 0 : -1,
    "aria-label": treeRowLabel(copy, row),
    "aria-level": row.depth + 1,
    "aria-rowindex": rowIndex + 2,
    onFocus: () => onFocusRow(row.id),
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => onRowKeyDown(row, event),
  };
}

function treeRowLabel(copy: SourceSelectionCopy, row: SourceSelectionTreePreviewNode): string {
  const state = stateLabel(copy, toBadgeState(row.effectiveState));
  const changed =
    row.changedKnownPages > 0
      ? copy.changedOnPage.replace("{count}", String(row.changedKnownPages))
      : row.changed
        ? copy.changed
        : "";
  const scope = row.kind === "folder" ? copy.descendantsHelp : copy.exactHelp;
  return [row.sourcePath, state, changed, scope].filter(Boolean).join(", ");
}

function findPreviousAncestorRowIndex(
  rows: readonly SourceSelectionTreePreviewNode[],
  currentIndex: number,
  currentDepth: number,
): number {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (rows[index]?.depth < currentDepth) {
      return index;
    }
  }
  return -1;
}

function StateBadge({
  copy,
  state,
}: {
  copy: SourceSelectionCopy;
  state: "included" | "excluded" | "mixed";
}) {
  if (state === "included") {
    return <Badge className="bg-emerald-100 text-emerald-700">{stateLabel(copy, state)}</Badge>;
  }
  if (state === "excluded") {
    return <Badge variant="outline">{stateLabel(copy, state)}</Badge>;
  }
  return <Badge variant="secondary">{stateLabel(copy, state)}</Badge>;
}

function stateLabel(copy: SourceSelectionCopy, state: "included" | "excluded" | "mixed"): string {
  if (state === "included") {
    return copy.selected;
  }
  if (state === "excluded") {
    return copy.excluded;
  }
  return copy.mixed;
}

function toBadgeState(
  state: SourceSelectionTreePreviewNode["effectiveState"],
): "included" | "excluded" | "mixed" {
  if (state === "included" || state === "canonicalized") {
    return "included";
  }
  if (state === "excluded") {
    return "excluded";
  }
  return "mixed";
}

function parentSourcePath(path: string): string {
  const segments = path.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "/";
  }
  return `/${segments.slice(0, -1).join("/")}`;
}

function extractPreviewError(body: unknown, status: number): PreviewError {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message =
    typeof record.error === "string" && record.error.trim()
      ? record.error
      : `Preview failed with status ${status}.`;
  const details = record.details;
  const detailsRecord =
    details && typeof details === "object" ? (details as Record<string, unknown>) : {};
  const validation = detailsRecord.validation;
  const validationItems = Array.isArray(validation) ? validation : validation ? [validation] : [];
  return {
    message,
    validation: validationItems.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const validationRecord = item as Record<string, unknown>;
      const itemMessage =
        typeof validationRecord.message === "string" ? validationRecord.message : message;
      return [
        {
          field: typeof validationRecord.field === "string" ? validationRecord.field : undefined,
          message: itemMessage,
        },
      ];
    }),
  };
}

function readSavedRouteTokens(meta: Record<string, unknown> | undefined): {
  routeConfigUpdatedAt: string | null;
  sourceSelectionFingerprint: string | null;
} {
  return {
    routeConfigUpdatedAt:
      typeof meta?.routeConfigUpdatedAt === "string" ? meta.routeConfigUpdatedAt : null,
    sourceSelectionFingerprint:
      typeof meta?.sourceSelectionFingerprint === "string" ? meta.sourceSelectionFingerprint : null,
  };
}

function readSavedSourceSelection(
  meta: Record<string, unknown> | undefined,
): SourceSelectionConfig | null {
  const sourceSelection = meta?.sourceSelection;
  if (!sourceSelection || typeof sourceSelection !== "object" || Array.isArray(sourceSelection)) {
    return null;
  }
  const rules = (sourceSelection as Record<string, unknown>).rules;
  if (!Array.isArray(rules)) {
    return null;
  }
  return {
    rules: rules.flatMap((rule) => {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return [];
      }
      const record = rule as Record<string, unknown>;
      if (
        (record.action !== "include" && record.action !== "exclude") ||
        typeof record.pattern !== "string"
      ) {
        return [];
      }
      return [{ action: record.action, pattern: record.pattern }];
    }),
  };
}

function rulesMatch(left: DraftSourceSelectionRule, right: DraftSourceSelectionRule): boolean {
  return left.action === right.action && left.pattern.trim() === right.pattern.trim();
}

function getRuleChangeState(
  rule: DraftSourceSelectionRule,
  persistedRules: readonly DraftSourceSelectionRule[],
): "new" | "edited" | null {
  const original = persistedRules.find((persistedRule) => persistedRule.id === rule.id);
  if (!original) {
    return persistedRules.some((persistedRule) => rulesMatch(rule, persistedRule)) ? null : "new";
  }
  return rulesMatch(rule, original) ? null : "edited";
}
