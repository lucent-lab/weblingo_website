// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InViewCountUp } from "./in-view-count-up";

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

type IntersectionObserverEntryInit = {
  isIntersecting: boolean;
  target: Element;
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private readonly callback: IntersectionObserverCallback;
  private readonly elements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.elements.add(element);
  };

  unobserve = (element: Element) => {
    this.elements.delete(element);
  };

  disconnect = () => {
    this.elements.clear();
  };

  trigger(entries: IntersectionObserverEntryInit[]) {
    const resolvedEntries = entries.map(
      (entry) =>
        ({
          isIntersecting: entry.isIntersecting,
          target: entry.target,
          time: Date.now(),
          intersectionRatio: entry.isIntersecting ? 1 : 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
        }) as IntersectionObserverEntry,
    );
    this.callback(resolvedEntries, this as unknown as IntersectionObserver);
  }

  triggerAll(isIntersecting = true) {
    this.trigger(
      Array.from(this.elements).map((target) => ({
        isIntersecting,
        target,
      })),
    );
  }
}

describe("InViewCountUp", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("animates up to the target value when entering the viewport", () => {
    stubMatchMedia(false);
    vi.stubGlobal(
      "IntersectionObserver",
      MockIntersectionObserver as unknown as typeof IntersectionObserver,
    );

    render(<InViewCountUp suffix="+" target={330} durationMs={400} />);

    expect(screen.getByText("0+")).toBeTruthy();
    expect(MockIntersectionObserver.instances).toHaveLength(1);

    act(() => {
      MockIntersectionObserver.instances[0].triggerAll(true);
    });

    act(() => {
      vi.advanceTimersByTime(420);
    });

    expect(screen.getByText("330+")).toBeTruthy();
  });

  it("renders the final value immediately when reduced motion is enabled", () => {
    stubMatchMedia(true);

    render(<InViewCountUp suffix="%" target={40} />);

    expect(screen.getByText("40%")).toBeTruthy();
  });
});
