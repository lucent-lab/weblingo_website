"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSiteAction, type ActionResponse } from "../../actions";

import { GlossaryTable } from "../glossary-table";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { GlossaryEntry, SupportedLanguage } from "@internal/dashboard/webhooks";
import { createLanguageNameResolver, normalizeLangTag } from "@internal/i18n";

const initialState: ActionResponse = {
  ok: false,
  message: "",
};

export function OnboardingForm(props: {
  maxLocales: number | null;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
  canGlossary: boolean;
  pricingPath: string;
}) {
  const [state, formAction] = useActionState(createSiteAction, initialState);
  const router = useRouter();
  const [targets, setTargets] = useState<string[]>([]);
  const [sourceLang, setSourceLang] = useState("");
  const [targetPickerValue, setTargetPickerValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [subdomainToken, setSubdomainToken] = useState("{lang}");
  const [patternEditing, setPatternEditing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [brandVoice, setBrandVoice] = useState("");
  const [siteProfileNotes, setSiteProfileNotes] = useState("");
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
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
    return subdomainPattern.includes("{lang}")
      ? subdomainPattern.replace("{lang}", sampleLang)
      : subdomainPattern;
  }, [subdomainPattern, targets]);
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
  const glossaryEntriesJson = useMemo(() => JSON.stringify(glossaryEntries), [glossaryEntries]);
  const languageLimitReached = props.maxLocales !== null && targets.length >= props.maxLocales;
  const languageSlotLabel = props.maxLocales === 1 ? "language slot" : "language slots";
  const targetLangs = useMemo(() => Array.from(new Set(targets)), [targets]);

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
        setLimitMessage(`Your plan allows up to ${props.maxLocales} target language(s) per site.`);
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
            Language limit:{" "}
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

          <input name="subdomainPattern" type="hidden" value={subdomainPattern} />
          <input name="siteProfile" type="hidden" value={profileJson} />
          <input name="glossaryEntries" type="hidden" value={glossaryEntriesJson} />

          <section className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Site basics &amp; routing</h3>
              <p className="text-sm text-muted-foreground">
                Source, languages, and routing pattern. All fields are required.
              </p>
            </div>
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
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  aria-invalid={showSourceUrlError}
                />
                <p className="text-xs text-muted-foreground">
                  The canonical origin we should crawl for translations.
                </p>
                {showSourceUrlError ? (
                  <p className="text-xs text-destructive">
                    Enter a valid URL that starts with http:// or https://.
                  </p>
                ) : null}
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
                  placeholder={
                    languageLimitReached ? "All language slots used" : "Add a target language..."
                  }
                  value={targetPickerValue}
                  onValueChange={handlePickTarget}
                  supportedLanguages={props.supportedLanguages}
                  displayLocale={props.displayLocale}
                  disabled={languageLimitReached}
                />
              </div>
              {props.supportedLanguages.length ? (
                <p className="text-xs text-muted-foreground">
                  {languageLimitReached && props.maxLocales !== null
                    ? `You've used all ${props.maxLocales} ${languageSlotLabel}. Remove one to add another.`
                    : "Search by language name or tag, or enter a custom language tag."}
                </p>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-foreground" htmlFor="subdomainToken">
                    Subdomain pattern
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPatternEditing((current) => !current)}
                  >
                    {patternEditing ? "Preview" : "Edit"}
                  </Button>
                </div>
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
                {!patternEditing ? (
                  <p className="text-xs text-muted-foreground">
                    We generate this from your source URL. Insert <code>{`{lang}`}</code> where the
                    locale should appear. Preview:{" "}
                    <span className="font-semibold text-foreground">{patternPreview || "-"}</span>
                  </p>
                ) : null}
                {showPatternError ? (
                  <p className="text-xs text-destructive">
                    Pattern must contain {"{lang}"} and a valid source domain.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Advanced</h3>
                <p className="text-sm text-muted-foreground">
                  Optional brand voice and glossary rules.
                </p>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="brandVoice">
                    Brand voice (optional)
                  </label>
                  <Input
                    id="brandVoice"
                    name="brandVoice"
                    value={brandVoice}
                    onChange={(event) => setBrandVoice(event.target.value)}
                    placeholder="Concise, confident, friendly"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Leave blank if you do not want tone guidance.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="siteProfileNotes">
                    Site profile (optional)
                  </label>
                  <Textarea
                    id="siteProfileNotes"
                    name="siteProfileNotes"
                    value={siteProfileNotes}
                    onChange={(event) => setSiteProfileNotes(event.target.value)}
                    placeholder="Examples: B2B SaaS for finance teams. Prefer formal tone. Keep product names untranslated."
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional context for translators. This does not override glossary rules.
                  </p>
                </div>
                {props.canGlossary ? (
                  <GlossaryTable
                    targetLangs={targetLangs}
                    initialEntries={[]}
                    onEntriesChange={setGlossaryEntries}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    Glossary editing is locked on your plan.{" "}
                    <Button asChild variant="link" size="sm">
                      <Link href={props.pricingPath}>Upgrade to unlock</Link>
                    </Button>
                  </div>
                )}
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
              We will create domains and enqueue a crawl right after you submit. You can verify DNS
              and update glossary from the site detail view.
            </p>
            <SubmitButton disabled={targets.length === 0 || !patternIsValid || !sourceUrlValid} />
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

function parseSourceUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function stripWwwPrefix(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}
