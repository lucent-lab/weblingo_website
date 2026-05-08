// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroGlyphField } from "./hero-glyph-field";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("HeroGlyphField", () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders as a decorative pointer-transparent glyph layer", () => {
    render(<HeroGlyphField className="hero-test-class" />);

    const field = screen.getByTestId("hero-glyph-field");
    expect(field.tagName).toBe("DIV");
    expect(field.getAttribute("aria-hidden")).toBe("true");
    expect(field.className).toContain("hero-test-class");
    expect(screen.getAllByText("文").length).toBeGreaterThan(0);
  });
});
