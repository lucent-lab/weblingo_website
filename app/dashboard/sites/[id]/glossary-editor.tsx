"use client";

import { useActionState, useMemo, useState } from "react";

import { updateGlossaryAction, type ActionResponse } from "../../actions";
import { GlossaryTable } from "../glossary-table";

import { Button } from "@/components/ui/button";
import type { GlossaryEntry } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

export function GlossaryEditor({
  siteId,
  initialEntries,
  targetLangs,
}: {
  siteId: string;
  initialEntries: GlossaryEntry[];
  targetLangs: string[];
}) {
  const [entries, setEntries] = useState<GlossaryEntry[]>(() => initialEntries);
  const [state, formAction] = useActionState(updateGlossaryAction, initialState);

  const serialized = useMemo(() => JSON.stringify(entries), [entries]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <input name="siteId" type="hidden" value={siteId} />
        <input name="entries" type="hidden" value={serialized} />

        <GlossaryTable
          targetLangs={targetLangs}
          initialEntries={initialEntries}
          onEntriesChange={setEntries}
        />

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
}
