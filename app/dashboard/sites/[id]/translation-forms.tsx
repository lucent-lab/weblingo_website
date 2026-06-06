"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { createOverrideAction, updateSlugAction, type ActionResponse } from "../../actions";

import {
  ExampleValuesBadge,
  exampleFieldClassName,
} from "@/components/dashboard/example-values-badge";
import { TargetLocaleSelect } from "@/components/dashboard/target-locale-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useActionToast } from "@internal/dashboard/use-action-toast";

const initialState: ActionResponse = { ok: false, message: "" };

type FormMode = "editable" | "example";

type OverrideExampleValues = {
  segmentId: string;
  targetLang: string;
  text: string;
  contextHashScope: string;
};

type SlugExampleValues = {
  pageId: string;
  lang: string;
  path: string;
};

export function OverrideForm({
  exampleBadgeLabel = "Example values",
  mode = "editable",
  siteId,
  targetLangs,
}: {
  exampleBadgeLabel?: string;
  mode?: FormMode;
  siteId: string;
  targetLangs: string[];
}) {
  if (mode === "example") {
    const values = buildOverrideExampleValues(targetLangs);
    return (
      <OverrideCard exampleBadgeLabel={exampleBadgeLabel} readOnlyExample>
        <div aria-label={exampleBadgeLabel} className="space-y-3">
          <OverrideFields readOnlyExample targetLangs={targetLangs} values={values} />
        </div>
      </OverrideCard>
    );
  }

  return <EditableOverrideForm siteId={siteId} targetLangs={targetLangs} />;
}

function EditableOverrideForm({ siteId, targetLangs }: { siteId: string; targetLangs: string[] }) {
  const [state, formAction, pending] = useActionState(createOverrideAction, initialState);
  const router = useRouter();
  const wasPending = useRef(false);
  const messageId = "override-status";
  const hasTargetLangs = targetLangs.length > 0;
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving override...",
    success: "Override saved.",
    error: "Unable to save override.",
  });

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.ok]);

  return (
    <OverrideCard>
      <form action={submitWithToast} className="space-y-3" aria-busy={pending}>
        <input name="siteId" type="hidden" value={siteId} />
        <OverrideFields
          messageId={state.message ? messageId : undefined}
          targetLangs={targetLangs}
        />
        {state.message && !state.ok ? (
          <p className="text-sm text-destructive" id={messageId} role="alert">
            {state.message}
          </p>
        ) : null}
        {!hasTargetLangs ? (
          <p className="text-sm text-muted-foreground">
            Add at least one target locale before saving manual overrides.
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !hasTargetLangs}>
            {pending ? "Saving..." : "Save override"}
          </Button>
        </div>
      </form>
    </OverrideCard>
  );
}

function OverrideCard({
  children,
  exampleBadgeLabel,
  readOnlyExample = false,
}: {
  children: ReactNode;
  exampleBadgeLabel?: string;
  readOnlyExample?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Manual override</CardTitle>
          {readOnlyExample ? <ExampleValuesBadge label={exampleBadgeLabel} /> : null}
        </div>
        <CardDescription>Submit a precise translation for a segment.</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function OverrideFields({
  messageId,
  readOnlyExample = false,
  targetLangs,
  values,
}: {
  messageId?: string;
  readOnlyExample?: boolean;
  targetLangs: string[];
  values?: OverrideExampleValues;
}) {
  const locales = targetLangs.length ? targetLangs : values?.targetLang ? [values.targetLang] : [];
  const fieldClassName = readOnlyExample ? exampleFieldClassName : undefined;
  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="segmentId">
          Segment ID
        </label>
        <Input
          aria-describedby={messageId}
          className={fieldClassName}
          defaultValue={values?.segmentId}
          disabled={readOnlyExample}
          id="segmentId"
          name="segmentId"
          placeholder="seg_123"
          readOnly={readOnlyExample}
          required={!readOnlyExample}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="targetLang">
            Target locale
          </label>
          <TargetLocaleSelect
            aria-describedby={messageId}
            className={readOnlyExample ? cn(exampleFieldClassName, "disabled:opacity-100") : ""}
            defaultValue={values?.targetLang}
            disabled={readOnlyExample}
            id="targetLang"
            locales={locales}
            name="targetLang"
            required={!readOnlyExample}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="text">
            Translated text
          </label>
          <Textarea
            aria-describedby={messageId}
            className={fieldClassName}
            defaultValue={values?.text}
            disabled={readOnlyExample}
            id="text"
            name="text"
            placeholder="Votre contenu..."
            readOnly={readOnlyExample}
            required={!readOnlyExample}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="contextHashScope">
          Context hash scope (optional)
        </label>
        <Input
          className={fieldClassName}
          defaultValue={values?.contextHashScope}
          disabled={readOnlyExample}
          id="contextHashScope"
          name="contextHashScope"
          placeholder="Use only when advised for ambiguous segments"
          readOnly={readOnlyExample}
        />
      </div>
    </>
  );
}

export function SlugForm({
  exampleBadgeLabel = "Example values",
  mode = "editable",
  siteId,
  targetLangs,
}: {
  exampleBadgeLabel?: string;
  mode?: FormMode;
  siteId: string;
  targetLangs: string[];
}) {
  if (mode === "example") {
    const values = buildSlugExampleValues(targetLangs);
    return (
      <SlugCard exampleBadgeLabel={exampleBadgeLabel} readOnlyExample>
        <div aria-label={exampleBadgeLabel} className="space-y-3">
          <SlugFields readOnlyExample targetLangs={targetLangs} values={values} />
        </div>
      </SlugCard>
    );
  }

  return <EditableSlugForm siteId={siteId} targetLangs={targetLangs} />;
}

function EditableSlugForm({ siteId, targetLangs }: { siteId: string; targetLangs: string[] }) {
  const [state, formAction, pending] = useActionState(updateSlugAction, initialState);
  const router = useRouter();
  const wasPending = useRef(false);
  const messageId = "slug-status";
  const hasTargetLangs = targetLangs.length > 0;
  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving slug...",
    success: "Slug saved.",
    error: "Unable to save slug.",
  });

  useEffect(() => {
    if (wasPending.current && !pending && state.ok) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.ok]);

  return (
    <SlugCard>
      <form action={submitWithToast} className="space-y-3" aria-busy={pending}>
        <input name="siteId" type="hidden" value={siteId} />
        <SlugFields messageId={state.message ? messageId : undefined} targetLangs={targetLangs} />
        {state.message && !state.ok ? (
          <p className="text-sm text-destructive" id={messageId} role="alert">
            {state.message}
          </p>
        ) : null}
        {!hasTargetLangs ? (
          <p className="text-sm text-muted-foreground">
            Add at least one target locale before saving localized slugs.
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !hasTargetLangs}>
            {pending ? "Saving..." : "Save slug"}
          </Button>
        </div>
      </form>
    </SlugCard>
  );
}

function SlugCard({
  children,
  exampleBadgeLabel,
  readOnlyExample = false,
}: {
  children: ReactNode;
  exampleBadgeLabel?: string;
  readOnlyExample?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Localized slug</CardTitle>
          {readOnlyExample ? <ExampleValuesBadge label={exampleBadgeLabel} /> : null}
        </div>
        <CardDescription>Normalize and publish a path for a translated page.</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SlugFields({
  messageId,
  readOnlyExample = false,
  targetLangs,
  values,
}: {
  messageId?: string;
  readOnlyExample?: boolean;
  targetLangs: string[];
  values?: SlugExampleValues;
}) {
  const locales = targetLangs.length ? targetLangs : values?.lang ? [values.lang] : [];
  const fieldClassName = readOnlyExample ? exampleFieldClassName : undefined;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="pageId">
          Page ID
        </label>
        <Input
          aria-describedby={messageId}
          className={fieldClassName}
          defaultValue={values?.pageId}
          disabled={readOnlyExample}
          id="pageId"
          name="pageId"
          placeholder="page_123"
          readOnly={readOnlyExample}
          required={!readOnlyExample}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="lang">
          Target locale
        </label>
        <TargetLocaleSelect
          aria-describedby={messageId}
          className={readOnlyExample ? cn(exampleFieldClassName, "disabled:opacity-100") : ""}
          defaultValue={values?.lang}
          disabled={readOnlyExample}
          id="lang"
          locales={locales}
          name="lang"
          required={!readOnlyExample}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="path">
          Path
        </label>
        <Input
          aria-describedby={messageId}
          className={fieldClassName}
          defaultValue={values?.path}
          disabled={readOnlyExample}
          id="path"
          name="path"
          placeholder="/fr/produits"
          readOnly={readOnlyExample}
          required={!readOnlyExample}
        />
      </div>
    </div>
  );
}

function buildOverrideExampleValues(targetLangs: string[]): OverrideExampleValues {
  const targetLang = firstTargetLang(targetLangs);
  return {
    segmentId: "seg_home_hero_cta",
    targetLang,
    text: exampleOverrideText(targetLang),
    contextHashScope: "home.hero.primary_cta",
  };
}

function buildSlugExampleValues(targetLangs: string[]): SlugExampleValues {
  const lang = firstTargetLang(targetLangs);
  return {
    pageId: "page_pricing",
    lang,
    path: exampleSlugPath(lang),
  };
}

function firstTargetLang(targetLangs: string[]): string {
  return targetLangs[0] ?? "fr";
}

function exampleOverrideText(lang: string): string {
  const values: Record<string, string> = {
    fr: "Demarrer l'essai",
    de: "Demo starten",
    es: "Iniciar demo",
  };
  return values[lang] ?? `Start demo (${lang})`;
}

function exampleSlugPath(lang: string): string {
  const values: Record<string, string> = {
    fr: "/fr/tarifs",
    ja: "/ja/pricing",
    de: "/de/preise",
    es: "/es/precios",
  };
  return values[lang] ?? `/${lang}/pricing`;
}
