"use client";

import { useMemo, useState } from "react";

import { LanguageTagCombobox } from "@/components/language-tag-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { createLanguageNameResolver, normalizeLangTag } from "@internal/i18n";
import { suggestLocaleAlias, validateLocaleAlias } from "./site-form-utils";

type TargetLanguagePickerProps = {
  targets: string[];
  aliases: Record<string, string>;
  onTargetsChange: (targets: string[]) => void;
  onAliasesChange: (aliases: Record<string, string>) => void;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
  maxLocales: number | null;
  disabled?: boolean;
  error?: string;
  showAliasHelp?: boolean;
};

export function TargetLanguagePicker({
  targets,
  aliases,
  onTargetsChange,
  onAliasesChange,
  supportedLanguages,
  displayLocale,
  maxLocales,
  disabled = false,
  error,
  showAliasHelp = true,
}: TargetLanguagePickerProps) {
  const [targetPickerValue, setTargetPickerValue] = useState("");
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const showError = Boolean(error);
  const hasAliases = Object.keys(aliases).length > 0;

  const resolveLanguageName = useMemo(
    () => createLanguageNameResolver(displayLocale),
    [displayLocale],
  );

  const supportedByTag = useMemo(() => {
    const map = new Map<string, SupportedLanguage>();
    for (const lang of supportedLanguages) {
      map.set(lang.tag, lang);
    }
    return map;
  }, [supportedLanguages]);

  const languageLimitReached = maxLocales !== null && targets.length >= maxLocales;
  const languageSlotLabel = maxLocales === 1 ? "language slot" : "language slots";

  const handleRemoveTarget = (lang: string) => {
    if (disabled) {
      return;
    }
    setLimitMessage(null);
    onTargetsChange(targets.filter((entry) => entry !== lang));
    if (Object.prototype.hasOwnProperty.call(aliases, lang)) {
      const next = { ...aliases };
      delete next[lang];
      onAliasesChange(next);
    }
  };

  const handlePickTarget = (nextValue: string) => {
    if (disabled) {
      return;
    }
    const normalized = normalizeLangTag(nextValue);
    if (!normalized) return;
    setLimitMessage(null);
    if (targets.includes(normalized)) {
      setTargetPickerValue("");
      return;
    }
    if (maxLocales !== null && targets.length >= maxLocales) {
      setLimitMessage(`Your plan allows up to ${maxLocales} target language(s) per site.`);
      return;
    }
    onTargetsChange([...targets, normalized]);
    setTargetPickerValue("");
  };

  const handleAliasToggle = (lang: string) => {
    if (disabled) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(aliases, lang)) {
      return;
    }
    const suggestion = suggestLocaleAlias(lang);
    onAliasesChange({ ...aliases, [lang]: suggestion });
  };

  const handleAliasRemove = (lang: string) => {
    if (disabled) {
      return;
    }
    const next = { ...aliases };
    delete next[lang];
    onAliasesChange(next);
  };

  const handleAliasChange = (lang: string, value: string) => {
    if (disabled) {
      return;
    }
    const normalized = value.toLowerCase().replace(/\s+/g, "");
    onAliasesChange({ ...aliases, [lang]: normalized });
  };

  return (
    <div className="space-y-3">
      {targets.length ? (
        <div className="space-y-2">
          {targets.map((tag) => {
            const fallbackEnglishName = supportedByTag.get(tag)?.englishName;
            const label = resolveLanguageName(tag, {
              fallbackEnglishName,
            });
            const aliasEnabled = Object.prototype.hasOwnProperty.call(aliases, tag);
            const aliasValue = aliasEnabled ? aliases[tag] : "";
            const aliasError = aliasEnabled ? validateLocaleAlias(aliasValue) : null;
            const aliasPlaceholder = suggestLocaleAlias(tag) || "alias";

            return (
              <div key={tag} className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">
                    {label === tag ? tag : `${label} (${tag})`}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {aliasEnabled ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAliasRemove(tag)}
                      >
                        Remove alias
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAliasToggle(tag)}
                      >
                        Alias
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleRemoveTarget(tag)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {aliasEnabled ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Alias</span>
                    <Input
                      value={aliasValue}
                      onChange={(event) => handleAliasChange(tag, event.target.value)}
                      placeholder={aliasPlaceholder}
                      className={cn("h-8 w-32 text-sm", aliasError ? "border-destructive" : "")}
                      aria-invalid={aliasError ? true : undefined}
                    />
                    {aliasError ? <span className="text-destructive">{aliasError}</span> : null}
                  </div>
                ) : null}
                {!disabled ? <input type="hidden" name="targetLangs" value={tag} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Add at least one target language.</p>
      )}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {limitMessage ? <p className="text-xs text-destructive">{limitMessage}</p> : null}

      {!languageLimitReached ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <LanguageTagCombobox
            className={cn(
              "sm:max-w-xs",
              showError ? "border-destructive focus-visible:ring-destructive" : "",
            )}
            placeholder="Add a target language..."
            value={targetPickerValue}
            onValueChange={handlePickTarget}
            supportedLanguages={supportedLanguages}
            displayLocale={displayLocale}
            invalid={showError}
            disabled={disabled}
          />
        </div>
      ) : null}

      {supportedLanguages.length ? (
        languageLimitReached && maxLocales !== null ? (
          <p className="text-xs text-muted-foreground">
            You have used all {maxLocales} {languageSlotLabel}. Remove one to add another.
          </p>
        ) : null
      ) : !disabled ? (
        <p className="text-xs text-muted-foreground">
          Language suggestions are unavailable right now. Please try again in a moment.
        </p>
      ) : null}

      {showAliasHelp && hasAliases ? (
        <p className="text-xs text-muted-foreground">
          Aliases replace <code>{`{lang}`}</code> in the URL pattern.
        </p>
      ) : null}
    </div>
  );
}
