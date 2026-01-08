"use client";

import { useActionState, useRef, useState } from "react";

import { updateGlossaryAction, type ActionResponse } from "../../actions";
import { GlossaryTable } from "../glossary-table";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@internal/dashboard/use-action-toast";
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
  const [state, formAction, pending] = useActionState(updateGlossaryAction, initialState);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving glossary...",
    success: "Glossary saved.",
    error: "Unable to save glossary.",
  });

  return (
    <div className="space-y-4">
      <form
        action={submitWithToast}
        className="space-y-3"
        aria-busy={pending}
        onSubmit={() => {
          if (hiddenRef.current) {
            hiddenRef.current.value = JSON.stringify(entries);
          }
        }}
      >
        <input name="siteId" type="hidden" value={siteId} />
        <input ref={hiddenRef} name="entries" type="hidden" defaultValue="" />

        <GlossaryTable
          targetLangs={targetLangs}
          initialEntries={initialEntries}
          onEntriesChange={setEntries}
        />

        <label className="flex items-center gap-2 text-sm">
          <input name="retranslate" type="checkbox" value="true" />
          Retranslate after glossary updates
        </label>

        {state.message && !state.ok ? (
          <div className="text-sm text-destructive" role="status">
            {state.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save glossary"}
          </Button>
        </div>
      </form>
    </div>
  );
}
