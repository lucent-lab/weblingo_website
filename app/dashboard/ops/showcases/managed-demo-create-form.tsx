"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { createManagedDemoAction, type ActionResponse } from "../../actions";
import { TargetLanguagePicker } from "../../sites/target-language-picker";
import { parseSourceUrl, stripWwwPrefix } from "../../sites/site-form-utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";

const LanguageTagCombobox = dynamic(
  () => import("@/components/language-tag-combobox").then((mod) => mod.LanguageTagCombobox),
  { ssr: false },
);

const initialState: ActionResponse = { ok: false, message: "" };

type ManagedDemoCreateFormProps = {
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
};

export function ManagedDemoCreateForm({
  supportedLanguages,
  displayLocale,
}: ManagedDemoCreateFormProps) {
  const [state, formAction, pending] = useActionState(createManagedDemoAction, initialState);
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLang, setSourceLang] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [aliasesByLang, setAliasesByLang] = useState<Record<string, string>>({});
  const [websitePath, setWebsitePath] = useState("");
  const [defaultLang, setDefaultLang] = useState("");

  const parsedSourceUrl = useMemo(() => parseSourceUrl(sourceUrl), [sourceUrl]);
  const sourceHost = parsedSourceUrl ? stripWwwPrefix(parsedSourceUrl.hostname) : "";
  const derivedWebsitePath = sourceHost.toLowerCase();
  const effectiveWebsitePath = websitePath.trim() || derivedWebsitePath;
  const targetLangs = useMemo(() => Array.from(new Set(targets)), [targets]);
  const effectiveDefaultLang =
    defaultLang && targetLangs.includes(defaultLang) ? defaultLang : (targetLangs[0] ?? "");
  const subdomainPattern = useMemo(() => {
    if (!parsedSourceUrl) {
      return "";
    }
    return `${parsedSourceUrl.protocol}//{lang}.${stripWwwPrefix(parsedSourceUrl.hostname)}`;
  }, [parsedSourceUrl]);
  const showcasePreview =
    effectiveWebsitePath && effectiveDefaultLang
      ? `https://t2.weblingo.app/${effectiveWebsitePath}/${effectiveDefaultLang}`
      : null;
  const customerPatternPreview = subdomainPattern
    ? subdomainPattern.replace("{lang}", effectiveDefaultLang || "fr")
    : null;

  const submitDisabled =
    pending || !parsedSourceUrl || !sourceLang || !targetLangs.length || !subdomainPattern;

  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Creating managed demo...",
    success: "Managed demo created.",
    error: "Unable to create managed demo.",
  });

  useEffect(() => {
    if (!state.ok) {
      return;
    }
    router.refresh();
  }, [router, state.ok]);

  return (
    <Card className="border-border/60 bg-background">
      <CardHeader className="space-y-2">
        <CardTitle>Create managed demo</CardTitle>
        <CardDescription>
          Bootstrap a managed demo account, its first site, and a public showcase URL on
          <span className="font-medium text-foreground"> t2.weblingo.app</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={submitWithToast} className="space-y-5">
          <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
          <input name="defaultLang" type="hidden" value={effectiveDefaultLang} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Source URL" htmlFor="managed-demo-source-url">
              <Input
                id="managed-demo-source-url"
                name="sourceUrl"
                type="url"
                placeholder="https://www.example.com"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                required
              />
            </Field>
            <Field label="Source language" htmlFor="managed-demo-source-lang">
              <LanguageTagCombobox
                id="managed-demo-source-lang"
                name="sourceLang"
                value={sourceLang}
                onValueChange={setSourceLang}
                supportedLanguages={supportedLanguages}
                displayLocale={displayLocale}
                placeholder="Select a language"
                required
              />
            </Field>
          </div>

          <Field
            label="Target languages"
            description="Pick the first locales you want ready for demos. The first one becomes the default showcase language unless you change it."
          >
            <TargetLanguagePicker
              targets={targets}
              aliases={aliasesByLang}
              onTargetsChange={setTargets}
              onAliasesChange={setAliasesByLang}
              supportedLanguages={supportedLanguages}
              displayLocale={displayLocale}
              maxLocales={null}
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Field
              label="Showcase path"
              htmlFor="managed-demo-website-path"
              description="Optional override. Leave blank to derive it from the source host."
            >
              <Input
                id="managed-demo-website-path"
                name="websitePath"
                placeholder={derivedWebsitePath || "autotrim.com"}
                value={websitePath}
                onChange={(event) => setWebsitePath(event.target.value.toLowerCase())}
              />
            </Field>
            <Field
              label="Default showcase language"
              htmlFor="managed-demo-default-lang"
              description="Visitors hitting the root showcase path will land on this language."
            >
              <select
                id="managed-demo-default-lang"
                name="defaultLangSelect"
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={effectiveDefaultLang}
                onChange={(event) => setDefaultLang(event.target.value)}
                disabled={!targetLangs.length}
              >
                {targetLangs.length === 0 ? (
                  <option value="">Pick target languages first</option>
                ) : null}
                {targetLangs.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 lg:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Showcase URL
              </p>
              <p className="font-mono text-sm text-foreground">
                {showcasePreview ??
                  "Enter a source URL and target language to preview the demo URL."}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer-domain pattern
              </p>
              <p className="font-mono text-sm text-foreground">
                {customerPatternPreview ?? "Derived after you enter the source URL."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showcase URLs stay public but ship with noindex and robots blocking. Customer domains
              still require DNS verification.
            </p>
            <Button type="submit" disabled={submitDisabled}>
              {pending ? "Creating..." : "Create managed demo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
