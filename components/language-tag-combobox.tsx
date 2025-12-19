"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createLanguageNameResolver, normalizeLangTag } from "@internal/i18n";

type SupportedLanguage = {
  tag: string;
  englishName: string;
  direction: "ltr" | "rtl";
};

type LanguageTagComboboxProps = {
  id?: string;
  name?: string;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  supportedLanguages: SupportedLanguage[];
  displayLocale: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function LanguageTagCombobox({
  id,
  name,
  required = false,
  value: rawValue,
  onValueChange,
  supportedLanguages,
  displayLocale,
  placeholder,
  searchPlaceholder = "Search languages...",
  emptyText = "No language found.",
  disabled = false,
  className,
}: LanguageTagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const value = rawValue.trim();

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

  const options = useMemo(() => {
    const mapped = supportedLanguages.map((lang) => {
      const label = resolveLanguageName(lang.tag, { fallbackEnglishName: lang.englishName });
      return {
        tag: lang.tag,
        label,
        keywords: [lang.tag, lang.englishName, label].filter(Boolean),
      };
    });
    mapped.sort((a, b) => a.label.localeCompare(b.label, displayLocale, { sensitivity: "base" }));
    return mapped;
  }, [displayLocale, resolveLanguageName, supportedLanguages]);

  const displayValue = useMemo(() => {
    if (!value) {
      return placeholder;
    }
    const fallbackEnglishName = supportedByTag.get(value)?.englishName ?? null;
    const label = resolveLanguageName(value, { fallbackEnglishName });
    return label === value ? value : `${label} (${value})`;
  }, [placeholder, resolveLanguageName, supportedByTag, value]);

  const customCandidate = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return null;
    }
    return normalizeLangTag(trimmed) ?? trimmed;
  }, [query]);

  const shouldOfferCustom =
    customCandidate !== null &&
    customCandidate.length > 0 &&
    !supportedByTag.has(customCandidate) &&
    customCandidate !== value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {shouldOfferCustom ? (
                <CommandItem
                  key={`custom:${customCandidate}`}
                  value={customCandidate ?? ""}
                  onSelect={(currentValue) => {
                    const normalized = normalizeLangTag(currentValue) ?? currentValue.trim();
                    if (!normalized) {
                      return;
                    }
                    onValueChange(normalized);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="truncate">{`Use "${customCandidate}"`}</span>
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.tag}
                  value={option.tag}
                  keywords={option.keywords}
                  onSelect={(currentValue) => {
                    const normalized = normalizeLangTag(currentValue) ?? currentValue.trim();
                    if (!normalized) {
                      return;
                    }
                    onValueChange(normalized);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{option.tag}</span>
                    <Check
                      className={cn("h-4 w-4", value === option.tag ? "opacity-100" : "opacity-0")}
                    />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
