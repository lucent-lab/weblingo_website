// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroOutcomeRotator } from "./hero-outcome-rotator";

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

describe("HeroOutcomeRotator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cycles outcomes on the configured interval", () => {
    stubMatchMedia(false);

    render(
      <HeroOutcomeRotator
        outcomes={["conversions", "bookings", "signups", "revenue"]}
        prefix="Turn international traffic into"
      />,
    );

    expect(screen.getByText("conversions")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText("bookings")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText("signups")).toBeTruthy();
  });

  it("stays on the first outcome when reduced motion is enabled", () => {
    stubMatchMedia(true);

    render(
      <HeroOutcomeRotator
        outcomes={["conversions", "bookings", "signups", "revenue"]}
        prefix="Turn international traffic into"
      />,
    );

    expect(screen.getByText("conversions")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });

    expect(screen.getByText("conversions")).toBeTruthy();
    expect(screen.queryByText("bookings")).toBeNull();
  });
});
