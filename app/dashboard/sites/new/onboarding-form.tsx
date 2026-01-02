"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type React from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Loader2 } from "lucide-react";

import { createSiteAction, type ActionResponse } from "../../actions";

import { TargetLanguagePicker } from "../target-language-picker";
import {
  buildLocaleAliases,
  hasInvalidAliases,
  parseSourceUrl,
  suggestLocaleAlias,
  stripWwwPrefix,
} from "../site-form-utils";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = {
  ok: false,
  message: "",
};
const REQUIRED_FIELDS_MESSAGE =
  "Please fill every required field and pick at least one target language.";

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
    const siteIdRaw = state.meta?.siteId;
    const siteId = typeof siteIdRaw === "string" ? siteIdRaw.trim() : "";
    const hasValidSiteId = siteId.length > 0 && siteId !== "undefined" && siteId !== "null";
    if (state.ok && hasValidSiteId) {
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
  const scheme = "https://";
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
    const sampleAlias = localeAliases[sampleLang] ?? suggestLocaleAlias(sampleLang);
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
      <CardHeader className="space-y-0">
        <CardTitle className="text-xl">Site setup</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="relative">
          <PendingOverlay />
          <PendingFieldset>
            <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
            <input name="localeAliases" type="hidden" value={localeAliasesJson} />
            <input name="servingMode" type="hidden" value="strict" />

            <section className="space-y-5">
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
                    className={cn(
                      "font-mono text-sm",
                      sourceUrlRequiredError
                        ? "border-destructive focus-visible:ring-destructive"
                        : "",
                    )}
                  />
                </Field>
                <Field
                  label="Source language"
                  htmlFor="sourceLang"
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
                <Field label="Target languages">
                  <TargetLanguagePicker
                    targets={targets}
                    aliases={aliasesByLang}
                    onTargetsChange={setTargets}
                    onAliasesChange={setAliasesByLang}
                    supportedLanguages={props.supportedLanguages}
                    displayLocale={props.displayLocale}
                    maxLocales={props.maxLocales}
                    error={targetsRequiredError ? "Pick at least one target language." : undefined}
                    showAliasHelp={patternEditing}
                  />
                </Field>
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
                    ) : null
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
                    <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                      {patternPreview ? (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Preview</span>
                          <div className="font-mono text-sm text-foreground">{patternPreview}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Enter a source URL to generate a preview.
                        </span>
                      )}
                    </div>
                  )}
                </Field>
              </div>
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

            <div className="flex justify-end">
              <SubmitButton disabled={submitDisabled} />
            </div>

            <div className="grid gap-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  We discover your site right away. Translations start after activation, and the
                  next screen provides activation instructions.
                </AlertDescription>
              </Alert>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Translated sites are served over HTTPS with automatic TLS certificates.
                </AlertDescription>
              </Alert>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Advanced settings can be configured later in site settings.
                </AlertDescription>
              </Alert>
            </div>
          </PendingFieldset>
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

function PendingFieldset({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset
      disabled={pending}
      aria-busy={pending}
      className={cn("space-y-6", pending ? "opacity-70" : "")}
    >
      {children}
    </fieldset>
  );
}

function PendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) {
    return null;
  }
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Creating site...
      </div>
    </div>
  );
}
