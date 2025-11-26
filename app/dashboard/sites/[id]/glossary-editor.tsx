"use client";

import { useActionState, useMemo, useState } from "react";

import { updateGlossaryAction, type ActionResponse } from "../../actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GlossaryEntry } from "@internal/dashboard/webhooks";

type GlossaryRow = {
  id: string;
  source: string;
  target: string;
  targetLangs?: string;
  matchType?: string;
  caseSensitive?: boolean;
};

const initialState: ActionResponse = { ok: false, message: "" };

export function GlossaryEditor({
  siteId,
  initialEntries,
}: {
  siteId: string;
  initialEntries: GlossaryEntry[];
}) {
  const [rows, setRows] = useState<GlossaryRow[]>(() => hydrateRows(initialEntries));
  const [state, formAction] = useActionState(updateGlossaryAction, initialState);

  const payload = useMemo(
    () =>
      rows
        .filter((row) => row.source.trim() && row.target.trim())
        .map((row) => ({
          source: row.source.trim(),
          target: row.target.trim(),
          matchType: row.matchType?.trim() || undefined,
          caseSensitive: row.caseSensitive,
          targetLangs:
            row.targetLangs && row.targetLangs.trim().length > 0
              ? (() => {
                  const langs = row.targetLangs
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  return langs.length > 0 ? langs : undefined;
                })()
              : undefined,
        })),
    [rows],
  );

  const serialized = JSON.stringify(payload);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add glossary pairs to keep brand terms consistent. Placeholder counts must match the source
          text.
        </p>
        <Button onClick={() => setRows((current) => [...current, blankRow()])} type="button" variant="outline" size="sm">
          Add entry
        </Button>
      </div>
      <form action={formAction} className="space-y-3">
        <input name="siteId" type="hidden" value={siteId} />
        <input name="entries" type="hidden" value={serialized} />

        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No glossary entries yet. Add a term pair to get started.
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-lg border border-border/60 bg-muted/40 p-3 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Source text
                  </label>
                  <Input
                    placeholder="Checkout"
                    value={row.source}
                    onChange={(event) => updateRow(index, { source: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Target text
                  </label>
                  <Input
                    placeholder="Paiement"
                    value={row.target}
                    onChange={(event) => updateRow(index, { target: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Target languages (comma separated, optional)
                  </label>
                  <Input
                    placeholder="fr, ja"
                    value={row.targetLangs ?? ""}
                    onChange={(event) => updateRow(index, { targetLangs: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Match type / Notes (optional)
                  </label>
                  <Textarea
                    className="min-h-[70px]"
                    placeholder="exact, startsWith, etc."
                    value={row.matchType ?? ""}
                    onChange={(event) => updateRow(index, { matchType: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input
                    checked={row.caseSensitive ?? false}
                    id={`case-${index}`}
                    name={`case-${index}`}
                    onChange={(event) => updateRow(index, { caseSensitive: event.target.checked })}
                    type="checkbox"
                  />
                  <label className="text-sm text-foreground" htmlFor={`case-${index}`}>
                    Case sensitive
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))}
                    type="button"
                    variant="ghost"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input name="retranslate" type="checkbox" value="true" />
          Retranslate after glossary updates
        </label>

        {state.message ? (
          <div
            className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}
            role="status"
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit">Save glossary</Button>
        </div>
      </form>
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

function hydrateRows(entries: GlossaryEntry[]): GlossaryRow[] {
  if (!entries || entries.length === 0) {
    return [blankRow()];
  }

  return entries.map((entry) => ({
    id: generateRowId(),
    source: entry.source,
    target: entry.target,
    matchType: entry.matchType,
    targetLangs: entry.targetLangs?.join(", "),
    caseSensitive: entry.caseSensitive,
  }));
}

function blankRow(): GlossaryRow {
  return {
    id: generateRowId(),
    source: "",
    target: "",
    targetLangs: "",
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
