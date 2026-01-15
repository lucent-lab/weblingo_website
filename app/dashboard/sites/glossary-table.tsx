"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GlossaryEntry } from "@internal/dashboard/webhooks";

type GlossaryRow = {
  id: string;
  source: string;
  targets: Record<string, string>;
  scope: "segment" | "in_segment";
  caseSensitive?: boolean;
  matchType?: string;
};

type GlossaryTableProps = {
  targetLangs: string[];
  initialEntries?: GlossaryEntry[];
  onEntriesChange?: (entries: GlossaryEntry[]) => void;
};

const tooltipCopy =
  "Replaces this term inside longer sentences using a protected placeholder before translation.";

export function GlossaryTable({
  targetLangs,
  initialEntries = [],
  onEntriesChange,
}: GlossaryTableProps) {
  const [rows, setRows] = useState<GlossaryRow[]>(() => hydrateRows(initialEntries, targetLangs));
  const hasTargetLangs = targetLangs.length > 0;
  const onEntriesChangeRef = useRef(onEntriesChange);

  useEffect(() => {
    setRows((current) => syncRowsWithTargets(current, targetLangs));
  }, [targetLangs]);

  useEffect(() => {
    onEntriesChangeRef.current = onEntriesChange;
  }, [onEntriesChange]);

  const entries = useMemo(
    () => rows.flatMap((row) => buildRowEntries(row, targetLangs)),
    [rows, targetLangs],
  );

  useEffect(() => {
    onEntriesChangeRef.current?.(entries);
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add glossary terms per language. Leave a cell empty to skip that language.
        </p>
        <Button
          onClick={() => setRows((current) => [...current, blankRow(targetLangs)])}
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasTargetLangs}
        >
          Add term
        </Button>
      </div>

      {!hasTargetLangs ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Add at least one target language to configure glossary terms.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No glossary entries yet. Add a term to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Source term</th>
                {targetLangs.map((lang) => (
                  <th key={lang} className="px-3 py-2 text-left">
                    <span className="font-mono text-xs">{lang}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-left">In-segment</th>
                <th className="px-3 py-2 text-left">Case</th>
                <th className="px-3 py-2 text-left">Match</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-border/50">
                  <td className="min-w-[220px] px-3 py-3 align-top">
                    <Input
                      placeholder="Checkout"
                      value={row.source}
                      onChange={(event) => updateRow(index, { source: event.target.value })}
                    />
                  </td>
                  {targetLangs.map((lang) => (
                    <td key={lang} className="min-w-[200px] px-3 py-3 align-top">
                      <Input
                        placeholder="Translation"
                        value={row.targets[lang] ?? ""}
                        onChange={(event) =>
                          updateRow(index, {
                            targets: { ...row.targets, [lang]: event.target.value },
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        checked={row.scope === "in_segment"}
                        onChange={(event) =>
                          updateRow(index, {
                            scope: event.target.checked ? "in_segment" : "segment",
                          })
                        }
                        type="checkbox"
                      />
                      <span className="inline-flex items-center gap-1 text-foreground">
                        In-segment
                        <span title={tooltipCopy} className="inline-flex">
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </span>
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        checked={row.caseSensitive ?? false}
                        onChange={(event) =>
                          updateRow(index, { caseSensitive: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span className="text-foreground">Case sensitive</span>
                    </label>
                  </td>
                  <td className="min-w-[140px] px-3 py-3 align-top">
                    <Input
                      placeholder="exact"
                      value={row.matchType ?? ""}
                      onChange={(event) => updateRow(index, { matchType: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-3 align-top text-right">
                    <Button
                      onClick={() =>
                        setRows((current) => current.filter((candidate) => candidate.id !== row.id))
                      }
                      type="button"
                      variant="ghost"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function updateRow(index: number, value: Partial<GlossaryRow>) {
    setRows((current) => {
      const copy = [...current];
      copy[index] = { ...copy[index], ...value };
      return copy;
    });
  }
}

function hydrateRows(entries: GlossaryEntry[], targetLangs: string[]): GlossaryRow[] {
  if (!targetLangs.length) {
    return [];
  }
  if (!entries || entries.length === 0) {
    return [blankRow(targetLangs)];
  }

  const rows: GlossaryRow[] = [];
  const rowMap = new Map<string, GlossaryRow>();

  for (const entry of entries) {
    const source = entry.source;
    const scope = entry.scope ?? "segment";
    const caseSensitive = entry.caseSensitive ?? false;
    const matchType = entry.matchType ?? "";
    const rowKey = `${source}::${scope}::${caseSensitive ? "1" : "0"}::${matchType}`;
    let row = rowMap.get(rowKey);
    if (!row) {
      row = {
        id: generateRowId(),
        source,
        targets: buildTargetMap(targetLangs),
        scope,
        caseSensitive,
        matchType,
      };
      rowMap.set(rowKey, row);
      rows.push(row);
    }

    const targets = entry.targetLangs && entry.targetLangs.length > 0 ? entry.targetLangs : null;
    if (targets) {
      for (const lang of targets) {
        if (!(lang in row.targets)) {
          continue;
        }
        row.targets[lang] = entry.target;
      }
    } else {
      for (const lang of targetLangs) {
        if (!row.targets[lang]) {
          row.targets[lang] = entry.target;
        }
      }
    }
  }

  return rows.length > 0 ? rows : [blankRow(targetLangs)];
}

function blankRow(targetLangs: string[]): GlossaryRow {
  return {
    id: generateRowId(),
    source: "",
    targets: buildTargetMap(targetLangs),
    scope: "segment",
    matchType: "",
    caseSensitive: false,
  };
}

function generateRowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function buildTargetMap(targetLangs: string[]): Record<string, string> {
  return Object.fromEntries(targetLangs.map((lang) => [lang, ""]));
}

function buildRowEntries(row: GlossaryRow, targetLangs: string[]): GlossaryEntry[] {
  const source = row.source.trim();
  if (!source) {
    return [];
  }
  const scope = row.scope;
  const caseSensitive = row.caseSensitive === true ? true : undefined;
  const matchType = row.matchType?.trim() || undefined;
  const entries: GlossaryEntry[] = [];
  for (const lang of targetLangs) {
    const target = row.targets[lang]?.trim() ?? "";
    if (!target) {
      continue;
    }
    entries.push({
      source,
      target,
      targetLangs: [lang],
      scope,
      caseSensitive,
      matchType,
    });
  }
  return entries;
}

function syncRowsWithTargets(rows: GlossaryRow[], targetLangs: string[]): GlossaryRow[] {
  if (!targetLangs.length) {
    return [];
  }
  if (rows.length === 0) {
    return [blankRow(targetLangs)];
  }
  return rows.map((row) => ({
    ...row,
    targets: alignTargets(row.targets, targetLangs),
  }));
}

function alignTargets(
  targets: Record<string, string>,
  targetLangs: string[],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const lang of targetLangs) {
    next[lang] = targets[lang] ?? "";
  }
  return next;
}
