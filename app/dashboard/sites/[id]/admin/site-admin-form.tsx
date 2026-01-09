"use client";

import { useActionState, useMemo, useState } from "react";

import { updateSiteSettingsAction, type ActionResponse } from "../../../actions";
import { TargetLanguagePicker } from "../../target-language-picker";
import {
  buildLocaleAliases,
  extractSubdomainToken,
  hasInvalidAliases,
  parseSourceUrl,
  suggestLocaleAlias,
  stripWwwPrefix,
} from "../../site-form-utils";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useActionToast } from "@internal/dashboard/use-action-toast";
import { REQUIRED_FIELDS_MESSAGE } from "@internal/dashboard/site-settings";
import type { CrawlCaptureMode, SupportedLanguage } from "@internal/dashboard/webhooks";

const initialState: ActionResponse = { ok: false, message: "" };

type SiteAdminFormProps = {
  siteId: string;
  sourceUrl: string;
  sourceLang: string;
  targets: string[];
  aliases: Record<string, string | null>;
  pattern: string | null;
  maxLocales: number | null;
  servingMode: "strict" | "tolerant";
  crawlCaptureMode: CrawlCaptureMode;
  canEditBasics: boolean;
  canEditLocales: boolean;
  canEditServingMode: boolean;
  canEditCrawlCaptureMode: boolean;
  crawlCaptureCopy: {
    title: string;
    description: string;
    label: string;
    help: string;
    options: {
      templatePlusHydrated: string;
      templateOnly: string;
      hydratedOnly: string;
    };
  };
  clientRuntimeEnabled: boolean;
  canEditClientRuntime: boolean;
  translatableAttributes: string[] | null;
  canEditTranslatableAttributes: boolean;
  canEditProfile: boolean;
  clientRuntimeCopy: {
    title: string;
    description: string;
    label: string;
    help: string;
  };
  translatableAttributesCopy: {
    title: string;
    description: string;
    label: string;
    help: string;
    placeholder: string;
  };
  lockedHelp: string;
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
  servingMode: initialServingMode,
  crawlCaptureMode: initialCrawlCaptureMode,
  canEditBasics,
  canEditLocales,
  canEditServingMode,
  canEditCrawlCaptureMode,
  crawlCaptureCopy,
  clientRuntimeEnabled: initialClientRuntimeEnabled,
  canEditClientRuntime,
  translatableAttributes: initialTranslatableAttributes,
  canEditTranslatableAttributes,
  canEditProfile,
  clientRuntimeCopy,
  translatableAttributesCopy,
  lockedHelp,
  supportedLanguages,
  displayLocale,
  initialBrandVoice = "",
  initialSiteProfileNotes = "",
}: SiteAdminFormProps) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialState);
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
  const [sourceUrlEditing, setSourceUrlEditing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [servingMode, setServingMode] = useState<"strict" | "tolerant">(initialServingMode);
  const [crawlCaptureMode, setCrawlCaptureMode] =
    useState<CrawlCaptureMode>(initialCrawlCaptureMode);
  const [clientRuntimeEnabled, setClientRuntimeEnabled] = useState<boolean>(
    initialClientRuntimeEnabled,
  );
  const [translatableAttributes, setTranslatableAttributes] = useState<string>(() =>
    (initialTranslatableAttributes ?? []).join(", "),
  );

  const parsedSourceUrl = useMemo(() => parseSourceUrl(sourceUrl), [sourceUrl]);
  const initialParsedUrl = useMemo(() => parseSourceUrl(initialSourceUrl), [initialSourceUrl]);
  const sourceUrlValid = parsedSourceUrl !== null;
  const showSourceUrlError = sourceUrl.trim().length > 0 && !sourceUrlValid;
  const sourceHost = parsedSourceUrl?.hostname ?? "";
  const trimmedHost = sourceHost ? stripWwwPrefix(sourceHost) : "";
  const displayHost = trimmedHost || "customer-url.com";
  const scheme = "https://";
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
  const requiresResetConfirm = canEditBasics && sourceUrlChanged && sourceUrlValid;

  const subdomainPattern = useMemo(() => {
    if (!trimmedHost || !normalizedSubdomainToken) {
      return "";
    }
    return `${scheme}${normalizedSubdomainToken}.${trimmedHost}`;
  }, [normalizedSubdomainToken, scheme, trimmedHost]);
  const patternIsValid =
    sourceUrlValid && subdomainPattern.includes("{lang}") && Boolean(trimmedHost);
  const showPatternError =
    canEditBasics && sourceUrlValid && sourceUrl.trim().length > 0 && !patternIsValid;
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
    const sampleAlias = localeAliases[sampleLang] ?? suggestLocaleAlias(sampleLang);
    return subdomainPattern.includes("{lang}")
      ? subdomainPattern.replace("{lang}", sampleAlias)
      : subdomainPattern;
  }, [localeAliases, subdomainPattern, targets]);
  const subdomainLabelFor = patternEditing ? "subdomainToken" : undefined;
  const sourceUrlLabelFor = sourceUrlEditing ? "sourceUrl" : undefined;
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
  const sourceUrlRequiredError = showRequiredErrors && canEditBasics && !sourceUrl.trim();
  const targetsRequiredError = showRequiredErrors && canEditLocales && targets.length === 0;
  const hasInvalidAlias = hasInvalidAliases(aliasesByLang);
  const resetConfirmationError = requiresResetConfirm && !confirmReset;

  const submitWithToast = useActionToast({
    formAction,
    state,
    pending,
    loading: "Saving site settings...",
    success: "Site settings saved.",
    error: "Unable to update site settings.",
  });
  const hasEditableSection =
    canEditBasics ||
    canEditLocales ||
    canEditServingMode ||
    canEditCrawlCaptureMode ||
    canEditClientRuntime ||
    canEditTranslatableAttributes ||
    canEditProfile;
  const basicsInvalid =
    canEditBasics && (!patternIsValid || !sourceUrlValid || resetConfirmationError);
  const localesInvalid = canEditLocales && (targets.length === 0 || hasInvalidAlias);
  const submitDisabled = !hasEditableSection || basicsInvalid || localesInvalid;
  const localeHelpText = canEditLocales ? undefined : lockedHelp;
  const servingHelpText = canEditServingMode
    ? "Strict waits for every page. Tolerant can complete when some pages fail and keeps previous content for those pages."
    : `Strict waits for every page. Tolerant can complete when some pages fail and keeps previous content for those pages. ${lockedHelp}`;
  const crawlCaptureHelpText = canEditCrawlCaptureMode
    ? crawlCaptureCopy.help
    : `${crawlCaptureCopy.help} ${lockedHelp}`;
  const clientRuntimeHelpText = canEditClientRuntime
    ? clientRuntimeCopy.help
    : `${clientRuntimeCopy.help} ${lockedHelp}`;
  const translatableAttributesHelpText = canEditTranslatableAttributes
    ? translatableAttributesCopy.help
    : `${translatableAttributesCopy.help} ${lockedHelp}`;

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
        <form action={submitWithToast} className="space-y-8" aria-busy={pending}>
          <input name="siteId" type="hidden" value={siteId} />
          {canEditBasics ? (
            <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
          ) : null}
          {canEditProfile ? <input name="siteProfile" type="hidden" value={profileJson} /> : null}
          {canEditLocales ? (
            <input name="localeAliases" type="hidden" value={localeAliasesJson} />
          ) : null}

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
                htmlFor={sourceUrlLabelFor}
                labelAction={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      canEditBasics ? setSourceUrlEditing((current) => !current) : null
                    }
                    disabled={!canEditBasics}
                    title={sourceUrlEditing ? "Preview" : "Edit"}
                  >
                    {sourceUrlEditing ? "Preview" : "Edit"}
                  </Button>
                }
                description="The canonical origin we should crawl for translations."
                error={
                  sourceUrlRequiredError
                    ? "Source URL is required."
                    : showSourceUrlError
                      ? "Enter a valid URL that starts with http:// or https://."
                      : undefined
                }
              >
                {sourceUrlEditing ? (
                  <Input
                    id="sourceUrl"
                    name="sourceUrl"
                    placeholder="https://www.example.com"
                    type="url"
                    required
                    value={sourceUrl}
                    onChange={(event) => {
                      setSourceUrl(event.target.value);
                      if (confirmReset) {
                        setConfirmReset(false);
                      }
                    }}
                    aria-invalid={sourceUrlRequiredError || showSourceUrlError}
                    disabled={!canEditBasics}
                    className={
                      sourceUrlRequiredError
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }
                  />
                ) : (
                  <>
                    {canEditBasics ? (
                      <input name="sourceUrl" type="hidden" value={sourceUrl} />
                    ) : null}
                    <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                      {sourceUrl ? (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Current</span>
                          <div className="font-mono text-sm text-foreground">{sourceUrl}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Enter a source URL to continue.
                        </span>
                      )}
                    </div>
                  </>
                )}
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
              <Field label="Target languages" description={localeHelpText}>
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
                  disabled={!canEditLocales}
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
                    onClick={() =>
                      canEditBasics ? setPatternEditing((current) => !current) : null
                    }
                    disabled={!canEditBasics}
                    title={patternEditing ? "Preview" : "Edit"}
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
                      disabled={!canEditBasics}
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

          <section className="space-y-5 border-t border-border/60 pt-6">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">Serving mode</CardTitle>
                  <CardDescription>
                    Choose how translation runs complete before serving updates.
                  </CardDescription>
                </div>
              </div>
            </div>
            <Field label="Completion behavior" htmlFor="servingMode" description={servingHelpText}>
              <select
                id="servingMode"
                name="servingMode"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={servingMode}
                onChange={(event) =>
                  setServingMode(event.target.value === "tolerant" ? "tolerant" : "strict")
                }
                disabled={!canEditServingMode}
              >
                <option value="strict">Strict (require all pages)</option>
                <option value="tolerant">Tolerant (serve with failures)</option>
              </select>
            </Field>
            {servingMode === "tolerant" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Tolerant mode keeps previously served pages when a page fails to translate. Use it
                when you prefer availability over completeness.
              </div>
            ) : null}
          </section>

          <section className="space-y-5 border-t border-border/60 pt-6">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {crawlCaptureCopy.title}
                  </CardTitle>
                  <CardDescription>{crawlCaptureCopy.description}</CardDescription>
                </div>
              </div>
            </div>
            <Field
              label={crawlCaptureCopy.label}
              htmlFor="crawlCaptureMode"
              description={
                <>
                  <span className="block">{crawlCaptureHelpText}</span>
                  <span className="mt-1 block">Default: template_plus_hydrated.</span>
                </>
              }
            >
              <select
                id="crawlCaptureMode"
                name="crawlCaptureMode"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={crawlCaptureMode}
                disabled={!canEditCrawlCaptureMode}
                onChange={(event) => setCrawlCaptureMode(event.target.value as CrawlCaptureMode)}
              >
                <option value="template_plus_hydrated">
                  {crawlCaptureCopy.options.templatePlusHydrated}
                </option>
                <option value="template_only">{crawlCaptureCopy.options.templateOnly}</option>
                <option value="hydrated_only">{crawlCaptureCopy.options.hydratedOnly}</option>
              </select>
            </Field>
          </section>

          <section className="space-y-5 border-t border-border/60 pt-6">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {clientRuntimeCopy.title}
                  </CardTitle>
                  <CardDescription>{clientRuntimeCopy.description}</CardDescription>
                </div>
              </div>
            </div>
            <Field
              label={clientRuntimeCopy.label}
              htmlFor="clientRuntimeEnabled"
              description={
                <>
                  <span className="block">{clientRuntimeHelpText}</span>
                  <span className="mt-1 block">Default: On.</span>
                </>
              }
            >
              {!canEditClientRuntime ? null : (
                <input type="hidden" name="clientRuntimeEnabled" value="false" />
              )}
              <input
                id="clientRuntimeEnabled"
                name="clientRuntimeEnabled"
                type="checkbox"
                value="true"
                checked={clientRuntimeEnabled}
                onChange={(event) => setClientRuntimeEnabled(event.target.checked)}
                disabled={!canEditClientRuntime}
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
          </section>

          <section className="space-y-5 border-t border-border/60 pt-6">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-1 rounded-full bg-primary/50" aria-hidden="true" />
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {translatableAttributesCopy.title}
                  </CardTitle>
                  <CardDescription>{translatableAttributesCopy.description}</CardDescription>
                </div>
              </div>
            </div>
            <Field
              label={translatableAttributesCopy.label}
              htmlFor="translatableAttributes"
              description={
                <>
                  <span className="block">{translatableAttributesHelpText}</span>
                  <span className="mt-1 block">
                    Default: aria-label, aria-description, aria-valuetext, aria-roledescription,
                    data-i18n.
                  </span>
                </>
              }
            >
              <Input
                id="translatableAttributes"
                name="translatableAttributes"
                value={translatableAttributes}
                onChange={(event) => setTranslatableAttributes(event.target.value)}
                placeholder={translatableAttributesCopy.placeholder}
                disabled={!canEditTranslatableAttributes}
              />
            </Field>
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
                title={advancedOpen ? "Hide" : "Show"}
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
                    disabled={!canEditProfile}
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
                    disabled={!canEditProfile}
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
              Updates do not trigger a crawl automatically. Use Force full website crawl when you
              are ready to refresh translations.
            </p>
            <SubmitButton disabled={submitDisabled} pending={pending} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  return (
    <Button
      disabled={disabled || pending}
      type="submit"
      title={pending ? "Saving..." : "Save changes"}
    >
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}
