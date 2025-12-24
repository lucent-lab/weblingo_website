"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateSiteSettingsAction, type ActionResponse } from "../../../actions";
import { TargetLanguagePicker } from "../../target-language-picker";
import {
  buildLocaleAliases,
  extractSubdomainToken,
  hasInvalidAliases,
  parseSourceUrl,
  stripWwwPrefix,
} from "../../site-form-utils";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };
const REQUIRED_FIELDS_MESSAGE = "Please fill every required field and pick at least one target language.";

type SiteAdminFormProps = {
  siteId: string;
  sourceUrl: string;
  sourceLang: string;
  targets: string[];
  aliases: Record<string, string | null>;
  pattern: string | null;
  maxLocales: number | null;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
  initialBrandVoice?: string;
  initialSiteProfileNotes?: string;
};

export function SiteAdminForm({
  siteId,
  sourceUrl: initialSourceUrl,
  sourceLang,
  targets: initialTargets,
  aliases,
  pattern,
  maxLocales,
  supportedLanguages,
  displayLocale,
  initialBrandVoice = "",
  initialSiteProfileNotes = "",
}: SiteAdminFormProps) {
  const [state, formAction] = useActionState(updateSiteSettingsAction, initialState);
  const [targets, setTargets] = useState<string[]>(() => initialTargets);
  const [aliasesByLang, setAliasesByLang] = useState<Record<string, string>>(() => {
    const entries = Object.entries(aliases).filter(
      ([, alias]) => typeof alias === "string" && alias.trim().length > 0,
    );
    return Object.fromEntries(entries) as Record<string, string>;
  });
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [brandVoice, setBrandVoice] = useState(initialBrandVoice);
  const [siteProfileNotes, setSiteProfileNotes] = useState(initialSiteProfileNotes);
  const [patternEditing, setPatternEditing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const parsedSourceUrl = useMemo(() => parseSourceUrl(sourceUrl), [sourceUrl]);
  const initialParsedUrl = useMemo(
    () => parseSourceUrl(initialSourceUrl),
    [initialSourceUrl],
  );
  const sourceUrlValid = parsedSourceUrl !== null;
  const showSourceUrlError = sourceUrl.trim().length > 0 && !sourceUrlValid;
  const sourceHost = parsedSourceUrl?.hostname ?? "";
  const trimmedHost = sourceHost ? stripWwwPrefix(sourceHost) : "";
  const displayHost = trimmedHost || "customer-url.com";
  const scheme = parsedSourceUrl?.protocol ? `${parsedSourceUrl.protocol}//` : "https://";
  const [subdomainToken, setSubdomainToken] = useState(() =>
    extractSubdomainToken(pattern, parsedSourceUrl),
  );
  const normalizedSubdomainToken = subdomainToken.trim().replace(/^\.+|\.+$/g, "");
  const normalizedInitialUrl = initialParsedUrl?.toString() ?? initialSourceUrl.trim();
  const normalizedSourceUrl = parsedSourceUrl?.toString() ?? sourceUrl.trim();
  const sourceUrlChanged =
    Boolean(normalizedSourceUrl) &&
    Boolean(normalizedInitialUrl) &&
    normalizedSourceUrl !== normalizedInitialUrl;
  const requiresResetConfirm = sourceUrlChanged && sourceUrlValid;

  useEffect(() => {
    if (!requiresResetConfirm) {
      setConfirmReset(false);
    }
  }, [requiresResetConfirm]);
  const subdomainPattern = useMemo(() => {
    if (!trimmedHost || !normalizedSubdomainToken) {
      return "";
    }
    return `${scheme}${normalizedSubdomainToken}.${trimmedHost}`;
  }, [normalizedSubdomainToken, scheme, trimmedHost]);
  const patternIsValid =
    sourceUrlValid && subdomainPattern.includes("{lang}") && Boolean(trimmedHost);
  const showPatternError = sourceUrlValid && sourceUrl.trim().length > 0 && !patternIsValid;
  const targetLangs = useMemo(() => Array.from(new Set(targets)), [targets]);
  const localeAliases = useMemo(
    () => buildLocaleAliases(targetLangs, aliasesByLang),
    [aliasesByLang, targetLangs],
  );
  const localeAliasesJson = useMemo(() => JSON.stringify(localeAliases), [localeAliases]);
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
  const profilePayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const trimmedVoice = brandVoice.trim();
    if (trimmedVoice) {
      payload.brandVoice = trimmedVoice;
    }
    const trimmedNotes = siteProfileNotes.trim();
    if (trimmedNotes) {
      payload.description = trimmedNotes;
    }
    return Object.keys(payload).length > 0 ? payload : null;
  }, [brandVoice, siteProfileNotes]);
  const profileJson = useMemo(
    () => (profilePayload ? JSON.stringify(profilePayload) : ""),
    [profilePayload],
  );
  const showRequiredErrors = state.message === REQUIRED_FIELDS_MESSAGE;
  const sourceUrlRequiredError = showRequiredErrors && !sourceUrl.trim();
  const targetsRequiredError = showRequiredErrors && targets.length === 0;
  const hasInvalidAlias = hasInvalidAliases(aliasesByLang);
  const resetConfirmationError = requiresResetConfirm && !confirmReset;
  const submitDisabled =
    targets.length === 0 ||
    !patternIsValid ||
    !sourceUrlValid ||
    hasInvalidAlias ||
    resetConfirmationError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site settings</CardTitle>
        <CardDescription>
          Update language coverage, routing patterns, and translation context for this site.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">
            Language limit:{" "}
            <span className="font-semibold text-foreground">
              {maxLocales === null ? "Unlimited" : maxLocales}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-8">
          <input name="siteId" type="hidden" value={siteId} />
          <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
          <input name="siteProfile" type="hidden" value={profileJson} />
          <input name="localeAliases" type="hidden" value={localeAliasesJson} />

          <section className="space-y-5">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/70" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Site basics &amp; routing
                  </CardTitle>
                  <CardDescription>
                    Source, languages, and routing pattern. All fields are required.
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Source URL"
                htmlFor="sourceUrl"
                description="The canonical origin we should crawl for translations."
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
                description="Source language is fixed once a site is created."
              >
                <LanguageTagCombobox
                  id="sourceLang"
                  name="sourceLang"
                  value={sourceLang}
                  onValueChange={() => undefined}
                  supportedLanguages={supportedLanguages}
                  displayLocale={displayLocale}
                  placeholder={sourceLang}
                  required
                  disabled
                />
              </Field>
            </div>
            {requiresResetConfirm ? (
              <Field
                label="Confirm URL reset"
                description="Changing the source URL clears pages, translations, and deployments. We'll re-scan sitemaps after verification."
                error={resetConfirmationError ? "Confirm the reset to continue." : undefined}
              >
                <label className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmReset}
                    onChange={(event) => setConfirmReset(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">
                      I understand this resets site data.
                    </span>
                    <span className="block text-muted-foreground">
                      Pages, translations, and deployments will be removed.
                    </span>
                  </span>
                </label>
              </Field>
            ) : null}
            <div className="space-y-4">
              <Field label="Target languages">
                <TargetLanguagePicker
                  targets={targets}
                  aliases={aliasesByLang}
                  onTargetsChange={setTargets}
                  onAliasesChange={setAliasesByLang}
                  supportedLanguages={supportedLanguages}
                  displayLocale={displayLocale}
                  maxLocales={maxLocales}
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

          <section className="space-y-3 border-t border-border/60 pt-6">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">Advanced</CardTitle>
                  <CardDescription>Optional brand voice and site profile notes.</CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                {advancedOpen ? "Hide" : "Show"}
              </Button>
            </div>
            {advancedOpen ? (
              <div className="space-y-6">
                <Field
                  label="Brand voice (optional)"
                  htmlFor="brandVoice"
                  description="Optional. Leave blank if you do not want tone guidance."
                >
                  <Input
                    id="brandVoice"
                    name="brandVoice"
                    value={brandVoice}
                    onChange={(event) => setBrandVoice(event.target.value)}
                    placeholder="Concise, confident, friendly"
                  />
                </Field>
                <Field
                  label="Site profile (optional)"
                  htmlFor="siteProfileNotes"
                  description="Optional context for translators. This does not override glossary rules."
                >
                  <Textarea
                    id="siteProfileNotes"
                    name="siteProfileNotes"
                    value={siteProfileNotes}
                    onChange={(event) => setSiteProfileNotes(event.target.value)}
                    placeholder="Examples: B2B SaaS for finance teams. Prefer formal tone. Keep product names untranslated."
                  />
                </Field>
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
              Updates do not trigger a crawl automatically. Use Trigger crawl when you are ready to
              refresh translations.
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
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}
