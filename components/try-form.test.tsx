// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TryForm } from "./try-form";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: () => {
      type MockComboboxProps = {
        value?: string;
        onValueChange?: (value: string) => void;
        disabled?: boolean;
        placeholder?: string;
      };
      return function MockLanguageTagCombobox(props: MockComboboxProps) {
        return React.createElement("input", {
          "data-testid": "mock-language-combobox",
          value: props.value ?? "",
          placeholder: props.placeholder ?? "",
          disabled: props.disabled,
          onChange: (event: Event) => {
            const target = event.currentTarget as HTMLInputElement;
            props.onValueChange?.(target.value);
          },
        });
      };
    },
  };
});

const PENDING_PREVIEW_STORAGE_KEY = "weblingo:try-form:pending-preview:v1";

const supportedLanguages = [
  { tag: "en", englishName: "English", direction: "ltr" },
  { tag: "fr", englishName: "French", direction: "ltr" },
] satisfies SupportedLanguage[];

const messages = {
  "try.form.button": "Generate preview",
  "try.form.placeholder": "https://example.com",
  "try.form.invalidUrl": "Invalid URL",
  "try.form.sourceLabel": "Source language",
  "try.form.targetLabel": "Target language",
  "try.form.sameLanguage": "Pick a different target language",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing preview...",
  "try.status.processingHint": "Processing hint",
  "try.status.stillProcessing": "Still processing",
  "try.status.ready": "Ready",
  "try.status.timedOutNoEmail": "Processing is taking longer than expected.",
  "try.action.checkStatus": "Check status",
  "try.action.checkingStatus": "Checking status...",
  "try.preview.linkLabel": "Preview link",
  "try.preview.open": "Open preview",
  "try.preview.copy": "Copy link",
  "try.preview.copied": "Copied",
  "try.error.default": "Preview failed.",
  "try.error.stageLabel": "Failed during {stage}",
  "try.stage.fetching_page": "Fetching page",
  "try.stage.analyzing_content": "Analyzing content",
  "try.stage.translating": "Translating",
  "try.stage.generating_preview": "Generating preview",
  "try.stage.saving": "Saving",
} as const;

type Listener = (event: MessageEvent | Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  readonly url: string;
  private readonly listeners = new Map<string, Listener[]>();
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, payload?: Record<string, unknown>): void {
    const listeners = this.listeners.get(type) ?? [];
    const event =
      payload === undefined
        ? new Event(type)
        : ({
            data: JSON.stringify(payload),
          } as MessageEvent);
    for (const listener of listeners) {
      listener(event);
    }
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderTryForm() {
  render(
    <TryForm
      locale="en"
      messages={messages}
      supportedLanguages={supportedLanguages}
      showEmailField={false}
    />,
  );
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
  globalThis.EventSource = originalEventSource;
});

describe("TryForm preview status", () => {
  it("persists pending preview state and clears it when SSE reaches ready", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "11111111-1111-1111-1111-111111111111",
          statusToken: "status-token",
          status: "pending",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const storedRaw = window.localStorage.getItem(PENDING_PREVIEW_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(String(storedRaw)) as Record<string, unknown>;
    expect(stored.previewId).toBe("11111111-1111-1111-1111-111111111111");
    expect(stored.statusToken).toBe("status-token");

    const stream = MockEventSource.instances[0];
    stream.emit("status", {
      status: "ready",
      previewUrl: "https://preview.test/p/abc",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(window.localStorage.getItem(PENDING_PREVIEW_STORAGE_KEY)).toBeNull();
    });
  });

  it("resumes a persisted preview status stream on load", async () => {
    window.localStorage.setItem(
      PENDING_PREVIEW_STORAGE_KEY,
      JSON.stringify({
        previewId: "22222222-2222-2222-2222-222222222222",
        statusToken: "resume-token",
        requestKey: "resume-key",
        updatedAt: Date.now(),
      }),
    );
    const fetchMock = vi.fn(async () => jsonResponse({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    expect(MockEventSource.instances[0]?.url).toContain(
      "/api/previews/22222222-2222-2222-2222-222222222222/stream?token=resume-token",
    );

    MockEventSource.instances[0]?.emit("status", {
      status: "ready",
      previewUrl: "https://preview.test/p/resumed",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(window.localStorage.getItem(PENDING_PREVIEW_STORAGE_KEY)).toBeNull();
    });
  });

  it("falls back to polling when EventSource is unavailable", async () => {
    vi.stubGlobal("EventSource", undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "33333333-3333-3333-3333-333333333333",
          statusToken: "poll-token",
          status: "pending",
        });
      }
      if (url === "/api/previews/33333333-3333-3333-3333-333333333333?token=poll-token") {
        return jsonResponse({
          status: "ready",
          previewUrl: "https://preview.test/p/poll",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/33333333-3333-3333-3333-333333333333?token=poll-token",
      );
      expect(screen.getByText("Ready")).toBeTruthy();
    });
  });

  it("surfaces timeout UI when polling fallback exceeds timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "44444444-4444-4444-4444-444444444444",
          statusToken: "timeout-token",
          status: "pending",
        });
      }
      return jsonResponse({
        status: "processing",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    await act(async () => {
      await flushPromises();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
      await flushPromises();
    });

    expect(screen.getByText("Processing is taking longer than expected.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check status" })).toBeTruthy();
  });
});
