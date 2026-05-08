"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TargetLocaleSelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children" | "defaultValue"
> & {
  locales: string[];
  defaultValue?: string | null;
  placeholder?: string;
};

export function TargetLocaleSelect({
  className,
  defaultValue,
  disabled,
  locales,
  placeholder = "Select a locale",
  required = true,
  ...props
}: TargetLocaleSelectProps) {
  const normalizedDefault = defaultValue && locales.includes(defaultValue) ? defaultValue : "";
  const isDisabled = disabled || locales.length === 0;

  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      defaultValue={normalizedDefault}
      disabled={isDisabled}
      required={required}
      {...props}
    >
      <option disabled={required} value="">
        {locales.length > 0 ? placeholder : "No target locales configured"}
      </option>
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {formatTargetLocaleLabel(locale)}
        </option>
      ))}
    </select>
  );
}

function formatTargetLocaleLabel(locale: string) {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    const label = displayNames.of(locale);
    if (label) {
      return `${label} (${locale})`;
    }
  } catch {
    // Fall through to the stable locale token.
  }
  return locale.toUpperCase();
}
