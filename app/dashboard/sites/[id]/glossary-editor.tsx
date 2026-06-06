"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateGlossaryAction, type ActionResponse } from "../../actions";
import { GlossaryTable } from "../glossary-table";

import { Button } from "@/components/ui/button";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import type { GlossaryEntry } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

export function GlossaryEditor({
  siteId,
  initialEntries,
  allowRetranslate = true,
  mode = "editable",
  targetLangs,
}: {
  siteId: string;
  initialEntries: GlossaryEntry[];
  allowRetranslate?: boolean;
  mode?: "editable" | "example";
  targetLangs: string[];
}) {
  const isExampleMode = mode === "example";
  const displayEntries =
    isExampleMode && initialEntries.length === 0
      ? buildExampleGlossaryEntries(targetLangs)
      : initialEntries;
  const [entries, setEntries] = useState<GlossaryEntry[]>(() => displayEntries);
  const [state, formAction, pending] = useActionState(updateGlossaryAction, initialState);
  const router = useRouter();
  const wasPending = useRef(false);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving glossary...",
    success: "Glossary saved.",
    error: "Unable to save glossary.",
  });

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.ok]);

  if (isExampleMode) {
    return (
      <div className="space-y-4">
        <GlossaryTable targetLangs={targetLangs} initialEntries={displayEntries} readOnlyExample />
      </div>
    );
  }

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

        {allowRetranslate ? (
          <label className="flex items-center gap-2 text-sm">
            <input name="retranslate" type="checkbox" value="true" />
            Retranslate after glossary updates
          </label>
        ) : null}

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

function buildExampleGlossaryEntries(targetLangs: string[]): GlossaryEntry[] {
  return targetLangs.flatMap((lang) => [
    {
      source: "Checkout",
      target: exampleTargetForLang(lang, "Checkout"),
      targetLangs: [lang],
      scope: "segment" as const,
      caseSensitive: false,
      matchType: "exact",
    },
    {
      source: "Free shipping",
      target: exampleTargetForLang(lang, "Free shipping"),
      targetLangs: [lang],
      scope: "in_segment" as const,
      caseSensitive: false,
      matchType: "exact",
    },
  ]);
}

type ExampleGlossarySource = "Checkout" | "Free shipping";

function exampleTargetForLang(lang: string, source: ExampleGlossarySource): string {
  const examples: Record<string, Record<ExampleGlossarySource, string>> = {
    fr: {
      Checkout: "Paiement",
      "Free shipping": "Livraison offerte",
    },
    de: {
      Checkout: "Kasse",
      "Free shipping": "Kostenloser Versand",
    },
    es: {
      Checkout: "Pagar",
      "Free shipping": "Envio gratis",
    },
  };
  return examples[lang]?.[source] ?? `${source} (${lang})`;
}
