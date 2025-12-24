"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { createLanguageNameResolver } from "@internal/i18n";

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
  invalid?: boolean;
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
  invalid = false,
}: LanguageTagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipNextFocusOpen = useRef(false);
  const pointerDownRef = useRef(false);

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
      const keywords = [lang.tag, lang.englishName, label].filter(Boolean);
      return {
        tag: lang.tag,
        label,
        keywords,
        searchValue: keywords.join(" "),
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

  const closePopover = (options: { clearQuery?: boolean } = {}) => {
    skipNextFocusOpen.current = true;
    setOpen(false);
    if (options.clearQuery) {
      setQuery("");
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handle = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(handle);
  }, [open]);

  const handleTriggerFocus = () => {
    if (!disabled) {
      if (skipNextFocusOpen.current) {
        skipNextFocusOpen.current = false;
        return;
      }
      if (pointerDownRef.current) {
        pointerDownRef.current = false;
        return;
      }
      setOpen(true);
    }
  };

  const handleTriggerPointerDown = () => {
    if (!disabled) {
      pointerDownRef.current = true;
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Escape") {
      closePopover({ clearQuery: true });
      return;
    }
    if (event.key.length === 1 || event.key === "Backspace") {
      setOpen(true);
      setQuery(event.key === "Backspace" ? "" : event.key);
      event.preventDefault();
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopover({ clearQuery: true });
      return;
    }
    if (event.key === "Tab") {
      closePopover();
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      skipNextFocusOpen.current = true;
      setQuery("");
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onFocus={handleTriggerFocus}
          onKeyDown={handleTriggerKeyDown}
          onPointerDown={handleTriggerPointerDown}
          className={cn(
            "w-full justify-between",
            invalid ? "border-destructive focus-visible:ring-destructive" : "",
            className,
          )}
        >
          <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleInputKeyDown}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.tag}
                  value={option.searchValue}
                  keywords={option.keywords}
                  onSelect={() => {
                    onValueChange(option.tag);
                    closePopover({ clearQuery: true });
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
