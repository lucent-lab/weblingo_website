// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TargetLocaleSelect } from "./target-locale-select";

describe("TargetLocaleSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders only configured target locales and keeps a valid default selected", () => {
    render(
      <TargetLocaleSelect aria-label="Target locale" defaultValue="fr" locales={["fr", "ja"]} />,
    );

    const select = screen.getByRole("combobox", { name: "Target locale" }) as HTMLSelectElement;
    expect(select.value).toBe("fr");
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "fr", "ja"]);
    expect(screen.getByRole("option", { name: "French (fr)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Japanese (ja)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Italian/i })).toBeNull();
  });

  it("falls back to the placeholder when the default is not configured", () => {
    render(
      <TargetLocaleSelect aria-label="Target locale" defaultValue="it" locales={["fr", "ja"]} />,
    );

    const select = screen.getByRole("combobox", { name: "Target locale" }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "fr", "ja"]);
  });

  it("disables itself when no target locales are configured", () => {
    render(<TargetLocaleSelect aria-label="Target locale" locales={[]} />);

    const select = screen.getByRole("combobox", { name: "Target locale" }) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "No target locales configured" })).toBeTruthy();
  });
});
