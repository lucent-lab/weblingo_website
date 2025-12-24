"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { createSiteAction, type ActionResponse } from "../../actions";

import { TargetLanguagePicker } from "../target-language-picker";
import {
  buildLocaleAliases,
  hasInvalidAliases,
  parseSourceUrl,
  stripWwwPrefix,
} from "../site-form-utils";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = {
  ok: false,
  message: "",
};
const REQUIRED_FIELDS_MESSAGE = "Please fill every required field and pick at least one target language.";

export function OnboardingForm(props: {
  maxLocales: number | null;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
}) {
  const [state, formAction] = useActionState(createSiteAction, initialState);
  const router = useRouter();
  const [targets, setTargets] = useState<string[]>([]);
  const [aliasesByLang, setAliasesByLang] = useState<Record<string, string>>({});
  const [sourceLang, setSourceLang] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [subdomainToken, setSubdomainToken] = useState("{lang}");
  const [patternEditing, setPatternEditing] = useState(false);

  useEffect(() => {
    const siteId = state.meta?.siteId;
    if (state.ok && typeof siteId === "string" && siteId.length > 0) {
      const toast = state.meta?.toast;
      const nextUrl =
        typeof toast === "string" && toast.length > 0
          ? `/dashboard/sites/${siteId}?toast=${encodeURIComponent(toast)}`
          : `/dashboard/sites/${siteId}`;
      router.push(nextUrl);
    }
  }, [router, state.meta?.siteId, state.meta?.toast, state.ok]);

  const parsedSourceUrl = useMemo(() => parseSourceUrl(sourceUrl), [sourceUrl]);
  const sourceUrlValid = parsedSourceUrl !== null;
  const showSourceUrlError = sourceUrl.trim().length > 0 && !sourceUrlValid;
  const sourceHost = parsedSourceUrl?.hostname ?? "";
  const trimmedHost = sourceHost ? stripWwwPrefix(sourceHost) : "";
  const displayHost = trimmedHost || "customer-url.com";
  const scheme = parsedSourceUrl?.protocol ? `${parsedSourceUrl.protocol}//` : "https://";
  const normalizedSubdomainToken = subdomainToken.trim().replace(/^\.+|\.+$/g, "");
  const targetLangs = useMemo(() => Array.from(new Set(targets)), [targets]);
  const localeAliases = useMemo(
    () => buildLocaleAliases(targetLangs, aliasesByLang),
    [aliasesByLang, targetLangs],
  );
  const localeAliasesJson = useMemo(() => JSON.stringify(localeAliases), [localeAliases]);
  const subdomainPattern = useMemo(() => {
    if (!trimmedHost || !normalizedSubdomainToken) {
      return "";
    }
    return `${scheme}${normalizedSubdomainToken}.${trimmedHost}`;
  }, [normalizedSubdomainToken, scheme, trimmedHost]);
  const patternIsValid =
    sourceUrlValid && subdomainPattern.includes("{lang}") && Boolean(trimmedHost);
  const showPatternError = sourceUrlValid && sourceUrl.trim().length > 0 && !patternIsValid;
  const patternPreview = useMemo(() => {
    if (!subdomainPattern) {
      return "";
    }
    const sampleLang = targets[0] || "preview";
    const sampleAlias = localeAliases[sampleLang] ?? sampleLang;
    return subdomainPattern.includes("{lang}")
      ? subdomainPattern.replace("{lang}", sampleAlias)
      : subdomainPattern;
  }, [localeAliases, subdomainPattern, targets]);
  const subdomainLabelFor = patternEditing ? "subdomainToken" : undefined;
  const showRequiredErrors = state.message === REQUIRED_FIELDS_MESSAGE;
  const sourceUrlRequiredError = showRequiredErrors && !sourceUrl.trim();
  const sourceLangRequiredError = showRequiredErrors && !sourceLang.trim();
  const targetsRequiredError = showRequiredErrors && targetLangs.length === 0;
  const hasInvalidAlias = hasInvalidAliases(aliasesByLang);
  const submitDisabled =
    targetLangs.length === 0 ||
    !patternIsValid ||
    !sourceUrlValid ||
    !sourceLang.trim() ||
    hasInvalidAlias;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site setup</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">
            Language limit:{" "}
            <span className="font-semibold text-foreground">
              {props.maxLocales === null ? "Unlimited" : props.maxLocales}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-8">
          <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
          <input name="localeAliases" type="hidden" value={localeAliasesJson} />

          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Source URL"
                htmlFor="sourceUrl"
                error={
                  sourceUrlRequiredError
                    ? "Source URL is required."
                    : showSourceUrlError
                      ? "Enter a valid URL that starts with http:// or https://."
                      : undefined
                }
              >
                <Input
                  id="sourceUrl"
                  name="sourceUrl"
                  placeholder="https://www.example.com"
                  type="url"
                  required
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  aria-invalid={sourceUrlRequiredError || showSourceUrlError}
                  className={
                    sourceUrlRequiredError ? "border-destructive focus-visible:ring-destructive" : ""
                  }
                />
              </Field>
              <Field
                label="Source language"
                htmlFor="sourceLang"
                description="Examples: en, fr-CA, pt-BR."
                error={sourceLangRequiredError ? "Select a source language." : undefined}
              >
                <LanguageTagCombobox
                  id="sourceLang"
                  name="sourceLang"
                  value={sourceLang}
                  onValueChange={setSourceLang}
                  supportedLanguages={props.supportedLanguages}
                  displayLocale={props.displayLocale}
                  placeholder="Select a language"
                  required
                  invalid={sourceLangRequiredError}
                />
              </Field>
            </div>
            <div className="space-y-4">
              <TargetLanguagePicker
                targets={targets}
                aliases={aliasesByLang}
                onTargetsChange={setTargets}
                onAliasesChange={setAliasesByLang}
                supportedLanguages={props.supportedLanguages}
                displayLocale={props.displayLocale}
                maxLocales={props.maxLocales}
                error={targetsRequiredError ? "Pick at least one target language." : undefined}
              />
              <Field
                label="Subdomain pattern"
                htmlFor={subdomainLabelFor}
                labelAction={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPatternEditing((current) => !current)}
                  >
                    {patternEditing ? "Preview" : "Edit"}
                  </Button>
                }
                description={
                  patternEditing ? (
                    <>
                      Insert <code>{`{lang}`}</code> where the locale should appear.
                    </>
                  ) : (
                    <>
                      Preview:{" "}
                      <span className="font-semibold text-foreground">{patternPreview || "-"}</span>
                    </>
                  )
                }
                error={
                  showPatternError
                    ? "Pattern must contain {lang} and a valid source domain."
                    : undefined
                }
              >
                {patternEditing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {scheme}
                    </span>
                    <Input
                      id="subdomainToken"
                      name="subdomainToken"
                      className="w-36"
                      value={subdomainToken}
                      onChange={(event) => setSubdomainToken(event.target.value)}
                      pattern=".*\\{lang\\}.*"
                      title="Pattern must include {lang}"
                      required
                    />
                    <span className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      .{displayHost}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {patternPreview || "Enter a source URL to generate a preview."}
                    </div>
                  </div>
                )}
              </Field>
            </div>
          </section>
          <p className="text-sm text-muted-foreground">
            Advanced settings can be configured later in site settings.
          </p>

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
              We validate the URL and seed pages. Activate after domain verification.
            </p>
            <SubmitButton disabled={submitDisabled} />
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
