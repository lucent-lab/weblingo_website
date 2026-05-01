"use client";

import { AlertTriangle, CheckCircle2, FolderTree, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  SourceSelectionPreviewResponse,
  SourceSelectionRule,
} from "@internal/dashboard/webhooks";

import {
  addOrReplaceRule,
  createDraftRule,
  deriveDisplayTreeFromPreview,
  descendantPatternForPath,
  normalizeRulesForForm,
  removeRulesByPattern,
  sourceSelectionFingerprint,
  toSourceSelectionConfig,
  type DraftSourceSelectionRule,
  type EditableSourceSelectionAction,
  type SourceSelectionTreeRow,
} from "./source-selection-model";

const PREVIEW_DEBOUNCE_MS = 350;
const PREVIEW_PAGE_SIZE = 100;

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
  includeAction: string;
  excludeAction: string;
  addIncludeRule: string;
  addExcludeRule: string;
  removeRule: string;
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
  validationTitle: string;
  previewErrorTitle: string;
  previewLoading: string;
  previewReady: string;
  previewBlocked: string;
  pagesTitle: string;
  pagesDescription: string;
  pagesEmpty: string;
  pageColumn: string;
  stateColumn: string;
  reasonColumn: string;
  actionsColumn: string;
  selected: string;
  excluded: string;
  mixed: string;
  defaultState: string;
  direct: string;
  inherited: string;
  changed: string;
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

export function SourceSelectionManager({
  siteId,
  initialRules,
  canEdit,
  saveAction,
  copy,
}: SourceSelectionManagerProps) {
  const initialDraftRules = useMemo(() => normalizeRulesForForm(initialRules), [initialRules]);
  const [persistedRules, setPersistedRules] =
    useState<DraftSourceSelectionRule[]>(initialDraftRules);
  const [draftRules, setDraftRules] = useState<DraftSourceSelectionRule[]>(initialDraftRules);
  const [preview, setPreview] = useState<SourceSelectionPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<PreviewError | null>(null);
  const [isPreviewLoading, setPreviewLoading] = useState(false);
  const [lastSuccessfulPreviewFingerprint, setLastSuccessfulPreviewFingerprint] = useState("");
  const [offset, setOffset] = useState(0);
  const [saveResult, setSaveResult] = useState<ActionResponse | null>(null);
  const [isSaving, setSaving] = useState(false);
  const requestIdRef = useRef(0);
  const draftFingerprintRef = useRef("");

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

  const updateDraftRules = useCallback(
    (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => {
      setDraftRules((current) => updater(current));
      setOffset(0);
      setSaveResult(null);
    },
    [],
  );

  useEffect(() => {
    if (!canEdit) {
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
            offset: String(offset),
          });
          const response = await fetch(
            `/api/dashboard/sites/${encodeURIComponent(siteId)}/source-selection/preview?${params.toString()}`,
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
          setPreview(body as SourceSelectionPreviewResponse);
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
  }, [canEdit, copy.previewErrorTitle, draftConfig, draftFingerprint, offset, siteId]);

  const savePreview = () => {
    if (!canSave || !preview) {
      return;
    }
    const saveFingerprint = draftFingerprint;
    setSaving(true);
    void (async () => {
      const formData = new FormData();
      formData.set("siteId", siteId);
      formData.set("sourceSelection", JSON.stringify(preview.sourceSelection));
      try {
        const result = await saveAction(undefined, formData);
        setSaveResult(result);
        if (!result.ok) {
          return;
        }
        const savedConfig = readSavedSourceSelection(result.meta) ?? preview.sourceSelection;
        const savedRules = normalizeRulesForForm(savedConfig.rules);
        setPersistedRules(savedRules);
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
    setOffset(0);
    setSaveResult(null);
  };

  const treeRows = useMemo(
    () => deriveDisplayTreeFromPreview(preview?.affectedPages ?? [], draftRules),
    [draftRules, preview?.affectedPages],
  );

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
      {preview?.warnings.length ? <WarningsAlert copy={copy} preview={preview} /> : null}
      {preview ? <PreviewSummary copy={copy} preview={preview} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{copy.pagesTitle}</CardTitle>
          <CardDescription>{copy.pagesDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {isPreviewLoading && !preview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.previewLoading}
            </div>
          ) : treeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.pagesEmpty}</p>
          ) : (
            <div className="space-y-4">
              <SourceSelectionTree
                canEdit={controlsCanEdit}
                copy={copy}
                rows={treeRows}
                onChange={updateDraftRules}
              />
              {preview ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {copy.paginationLabel
                      .replace("{start}", String(preview.pagination.offset + 1))
                      .replace(
                        "{end}",
                        String(preview.pagination.offset + preview.affectedPages.length),
                      )
                      .replace("{total}", String(preview.pagination.total))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={preview.pagination.offset <= 0 || isPreviewLoading}
                      onClick={() => setOffset(Math.max(0, offset - PREVIEW_PAGE_SIZE))}
                    >
                      {copy.previousPage}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!preview.pagination.hasMore || isPreviewLoading}
                      onClick={() => setOffset(offset + PREVIEW_PAGE_SIZE)}
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
  rules,
  onChange,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  rules: DraftSourceSelectionRule[];
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
}) {
  const addRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => [...current, createDraftRule(action, "/")]);
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noRules}</p> : null}
      {rules.map((rule, index) => {
        const actionId = `source-selection-action-${rule.id}`;
        const patternId = `source-selection-pattern-${rule.id}`;
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit}
          onClick={() => addRule("include")}
        >
          <Plus className="mr-2 h-4 w-4" />
          {copy.addIncludeRule}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canEdit}
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
  preview: SourceSelectionPreviewResponse;
}) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{copy.warningsTitle}</AlertTitle>
      <AlertDescription>
        <ul className="space-y-2">
          {preview.warnings.map((warning) => (
            <li key={`${warning.code}-${warning.message}`}>
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

function PreviewSummary({
  copy,
  preview,
}: {
  copy: SourceSelectionCopy;
  preview: SourceSelectionPreviewResponse;
}) {
  const items = [
    [copy.knownIncluded, preview.summary.knownPagesIncluded],
    [copy.knownExcluded, preview.summary.knownPagesExcluded],
    [copy.includedByDefault, preview.summary.includedByDefault],
    [copy.includedByRule, preview.summary.includedByRule],
    [copy.excludedByRule, preview.summary.excludedByRule],
    [copy.notIncludedByRule, preview.summary.notIncludedByRule],
    [copy.rulesTotal, preview.summary.rulesTotal],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.summaryTitle}</CardTitle>
        <CardDescription>{copy.summaryDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border/60 bg-muted/20 p-3">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="font-mono text-2xl font-semibold text-foreground">{value}</p>
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
  onChange,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  rows: SourceSelectionTreeRow[];
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">{copy.pageColumn}</th>
            <th className="px-3 py-2 text-left">{copy.stateColumn}</th>
            <th className="px-3 py-2 text-left">{copy.reasonColumn}</th>
            <th className="px-3 py-2 text-right">{copy.actionsColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.kind === "folder" ? (
              <FolderRow key={row.id} canEdit={canEdit} copy={copy} row={row} onChange={onChange} />
            ) : (
              <PageRow key={row.id} canEdit={canEdit} copy={copy} row={row} onChange={onChange} />
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
  onChange,
  row,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
  row: Extract<SourceSelectionTreeRow, { kind: "folder" }>;
}) {
  const descendantPattern = descendantPatternForPath(row.path);
  const setDescendantRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => addOrReplaceRule(current, { action, pattern: descendantPattern }));
  };
  const clearDescendantRule = () => {
    onChange((current) => removeRulesByPattern(current, descendantPattern));
  };

  return (
    <tr className="border-t border-border/50 bg-muted/10">
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 1.1}rem` }}>
          <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="break-all font-mono text-xs text-foreground">{row.path}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{copy.descendantsHelp}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <StateBadge copy={copy} state={row.effectiveState} />
      </td>
      <td className="px-3 py-3 align-top text-muted-foreground">
        <span className="font-mono text-xs">
          {row.includedCount}/{row.totalCount}
        </span>{" "}
        {copy.selected}
        {row.descendantRuleAction ? (
          <div className="mt-1">
            <Badge variant="outline">{copy.direct}</Badge>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right align-top">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() => setDescendantRule("include")}
          >
            {copy.includeDescendants}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() => setDescendantRule("exclude")}
          >
            {copy.excludeDescendants}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
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
  onChange,
  row,
}: {
  canEdit: boolean;
  copy: SourceSelectionCopy;
  onChange: (updater: (rules: DraftSourceSelectionRule[]) => DraftSourceSelectionRule[]) => void;
  row: Extract<SourceSelectionTreeRow, { kind: "page" }>;
}) {
  const page = row.page;
  const state = page.selected ? "included" : "excluded";
  const setPageRule = (action: EditableSourceSelectionAction) => {
    onChange((current) => addOrReplaceRule(current, { action, pattern: page.sourcePath }));
  };
  const clearPageRule = () => {
    onChange((current) => removeRulesByPattern(current, page.sourcePath));
  };

  return (
    <tr className="border-t border-border/50">
      <td className="px-3 py-3 align-top">
        <div style={{ paddingLeft: `${row.depth * 1.1}rem` }}>
          <span className="break-all rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
            {page.sourcePath}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{copy.exactHelp}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge copy={copy} state={state} />
          {page.changed ? <Badge variant="outline">{copy.changed}</Badge> : null}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="space-y-1 text-muted-foreground">
          <p>{copy.reasonLabels[page.reason]}</p>
          <p className="text-xs">
            {page.matchedPattern ? (
              <>
                {copy.matchedPattern}{" "}
                <span className="font-mono text-foreground">{page.matchedPattern}</span>
              </>
            ) : (
              copy.noMatchedPattern
            )}
          </p>
          <div className="flex flex-wrap gap-1">
            {page.directRule ? <Badge variant="outline">{copy.direct}</Badge> : null}
            {page.inheritedRule || page.ruleScope === "inherited" ? (
              <Badge variant="secondary">{copy.inherited}</Badge>
            ) : null}
            {!page.directRule && !page.inheritedRule && !page.matchedPattern ? (
              <Badge variant="outline">{copy.defaultState}</Badge>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right align-top">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() => setPageRule("include")}
          >
            {copy.includePage}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() => setPageRule("exclude")}
          >
            {copy.excludePage}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
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

function StateBadge({
  copy,
  state,
}: {
  copy: SourceSelectionCopy;
  state: "included" | "excluded" | "mixed";
}) {
  if (state === "included") {
    return <Badge className="bg-emerald-100 text-emerald-700">{copy.selected}</Badge>;
  }
  if (state === "excluded") {
    return <Badge variant="outline">{copy.excluded}</Badge>;
  }
  return <Badge variant="secondary">{copy.mixed}</Badge>;
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
