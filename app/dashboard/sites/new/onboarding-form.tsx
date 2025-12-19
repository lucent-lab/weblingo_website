"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { createSiteAction, type ActionResponse } from "../../actions";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { createLanguageNameResolver, normalizeLangTag } from "@internal/i18n";

const initialProfile = JSON.stringify(
  {
    brandVoice: "Concise, confident, helpful",
    audience: "Growth and marketing teams",
    glossary: ["WebLingo", "translation", "Cloudflare"],
  },
  null,
  2,
);

const initialState: ActionResponse = {
  ok: false,
  message: "",
};

export function OnboardingForm(props: {
  maxLocales: number | null;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
}) {
  const [state, formAction] = useActionState(createSiteAction, initialState);
  const router = useRouter();
  const [targets, setTargets] = useState<string[]>([]);
  const [sourceLang, setSourceLang] = useState("");
  const [targetPickerValue, setTargetPickerValue] = useState("");
  const [pattern, setPattern] = useState("https://{lang}.example.com");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const resolveLanguageName = useMemo(
    () => createLanguageNameResolver(props.displayLocale),
    [props.displayLocale],
  );

  const supportedByTag = useMemo(() => {
    const map = new Map<string, SupportedLanguage>();
    for (const lang of props.supportedLanguages) {
      map.set(lang.tag, lang);
    }
    return map;
  }, [props.supportedLanguages]);

  useEffect(() => {
    const siteId = state.meta?.siteId;
    if (state.ok && typeof siteId === "string" && siteId.length > 0) {
      router.push(`/dashboard/sites/${siteId}`);
    }
  }, [router, state.meta?.siteId, state.ok]);

  const patternPreview = useMemo(() => {
    const sampleLang = targets[0] || "{lang}";
    const output = pattern.includes("{lang}")
      ? pattern.replace("{lang}", sampleLang)
      : `${pattern}/${sampleLang}`;
    return output.replace(/(?<!:)\/{2,}/g, "/");
  }, [pattern, targets]);

  const handleRemoveTarget = (lang: string) => {
    setLimitMessage(null);
    setTargets((current) => current.filter((entry) => entry !== lang));
  };

  const handlePickTarget = (nextValue: string) => {
    const normalized = normalizeLangTag(nextValue);
    if (!normalized) return;
    setLimitMessage(null);
    setTargets((current) => {
      if (current.includes(normalized)) {
        return current;
      }
      if (props.maxLocales !== null && current.length >= props.maxLocales) {
        setLimitMessage(`Your plan allows up to ${props.maxLocales} target locale(s) per site.`);
        return current;
      }
      return [...current, normalized];
    });
    setTargetPickerValue("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding wizard</CardTitle>
        <CardDescription>
          Provide your source site, pick target languages, and define the subdomain pattern. We will
          enqueue a crawl immediately after creation.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">
            Locale limit:{" "}
            <span className="font-semibold text-foreground">
              {props.maxLocales === null ? "Unlimited" : props.maxLocales}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-8">
          {props.supportedLanguages.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Language suggestions are unavailable right now. You can still enter BCP 47 tags
              manually (for example <code>en</code>, <code>fr-CA</code>, <code>pt-BR</code>).
            </div>
          ) : null}

          <section className="space-y-3">
            <StepHeader
              step={1}
              title="Site basics"
              helper="We use this to crawl your source pages and seed localized routes."
              active={step === 1}
              onClick={() => setStep(1)}
            />
            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="sourceUrl">
                    Source URL
                  </label>
                  <Input
                    id="sourceUrl"
                    name="sourceUrl"
                    placeholder="https://www.example.com"
                    type="url"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The canonical origin we should crawl for translations.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="sourceLang">
                    Source language
                  </label>
                  <LanguageTagCombobox
                    id="sourceLang"
                    name="sourceLang"
                    value={sourceLang}
                    onValueChange={setSourceLang}
                    supportedLanguages={props.supportedLanguages}
                    displayLocale={props.displayLocale}
                    placeholder="en (or a BCP 47 tag)"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick a language tag (BCP 47 style). Examples: en, fr-CA, pt-BR.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <StepHeader
              step={2}
              title="Target languages & routing"
              helper="Select target locales and preview how subdomains will look."
              active={step === 2}
              onClick={() => setStep(2)}
            />
            {step === 2 ? (
              <div className="space-y-4">
                {targets.length ? (
                  <div className="flex flex-wrap gap-2">
                    {targets.map((tag) => {
                      const fallbackEnglishName = supportedByTag.get(tag)?.englishName;
                      const label = resolveLanguageName(tag, {
                        fallbackEnglishName,
                      });
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm"
                        >
                          <span className="font-medium text-foreground">
                            {label === tag ? tag : `${label} (${tag})`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleRemoveTarget(tag)}
                          >
                            Remove
                          </Button>
                          <input type="hidden" name="targetLangs" value={tag} />
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add at least one target language to start translating.
                  </p>
                )}
                {limitMessage ? <p className="text-xs text-destructive">{limitMessage}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <LanguageTagCombobox
                    className="sm:max-w-xs"
                    placeholder="Add a target language..."
                    value={targetPickerValue}
                    onValueChange={handlePickTarget}
                    supportedLanguages={props.supportedLanguages}
                    displayLocale={props.displayLocale}
                    disabled={props.maxLocales !== null && targets.length >= props.maxLocales}
                  />
                </div>
                {props.supportedLanguages.length ? (
                  <p className="text-xs text-muted-foreground">
                    Search by language name or tag, or enter a custom language tag.
                  </p>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="subdomainPattern">
                    Subdomain pattern
                  </label>
                  <Input
                    id="subdomainPattern"
                    name="subdomainPattern"
                    placeholder="https://{lang}.example.com"
                    required
                    value={pattern}
                    pattern=".*\\{lang\\}.*"
                    title="Pattern must include {lang}"
                    onChange={(event) => setPattern(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must include <code>{`{lang}`}</code>. We seed domain records and route prefixes
                    from this pattern. Preview:{" "}
                    <span className="font-semibold text-foreground">{patternPreview}</span>
                  </p>
                  {!pattern.includes("{lang}") ? (
                    <p className="text-xs text-destructive">Pattern must contain {"{lang}"}.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <StepHeader
              step={3}
              title="Brand voice"
              helper="Share tone and glossary hints. We reject empty objects to keep translations consistent."
              active={step === 3}
              onClick={() => setStep(3)}
            />
            {step === 3 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="siteProfile">
                  Site profile JSON
                </label>
                <Textarea
                  id="siteProfile"
                  name="siteProfile"
                  defaultValue={initialProfile}
                  required
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Keep it short and structured — values are validated and empty objects are
                  rejected.
                </p>
              </div>
            ) : null}
          </section>

          {state.message ? (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                state.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              We will create domains and enqueue a crawl right after this step. You can verify DNS
              and update glossary from the site detail view.
            </p>
            <SubmitButton
              disabled={targets.length === 0 || step !== 3 || !pattern.includes("{lang}")}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={disabled || pending} type="submit">
      {pending ? "Creating..." : "Create site"}
    </Button>
  );
}

function StepHeader(props: {
  step: number;
  title: string;
  helper: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        props.active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
      )}
      onClick={props.onClick}
      type="button"
    >
      <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/10 text-center text-sm font-semibold text-primary">
        {props.step}
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.helper}</p>
      </div>
    </button>
  );
}
