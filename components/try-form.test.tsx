// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TryForm } from "./try-form";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import {
  buildPreviewStatusCenterRequestKey,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  resetPreviewStatusCenterStoreForTests,
} from "@internal/previews/status-center-store";

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
  "try.status.creating": "Creating preview...",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing preview...",
  "try.status.processingHint": "Processing hint",
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
  "try.error.preview_expired": "Preview expired",
  "try.error.preview_not_found": "Preview not found",
  "try.error.unknown": "Unknown error",
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

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  resetPreviewStatusCenterStoreForTests();
  window.localStorage.clear();
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetPreviewStatusCenterStoreForTests();
  globalThis.EventSource = originalEventSource;
});

describe("TryForm preview status", () => {
  it("persists preview jobs in v2 storage and marks ready from SSE", async () => {
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

    const storedRaw = window.localStorage.getItem(PREVIEW_STATUS_CENTER_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const storedJobs = JSON.parse(String(storedRaw)) as Array<Record<string, unknown>>;
    expect(storedJobs[0].previewId).toBe("11111111-1111-1111-1111-111111111111");

    MockEventSource.instances[0].emit("status", {
      status: "ready",
      previewUrl: "https://preview.test/p/abc",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByDisplayValue("https://preview.test/p/abc")).toBeTruthy();
    });
  });

  it("restores persisted v2 jobs on mount without reopening SSE", async () => {
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "22222222-2222-2222-2222-222222222222",
          requestKey: "https://restore.example.com|en|fr|",
          statusToken: "restore-token",
          sourceUrl: "https://restore.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "processing",
          stage: "translating",
          previewUrl: null,
          error: null,
          errorCode: null,
          errorStage: null,
          createdAt: Date.now() - 1_000,
          updatedAt: Date.now() - 1_000,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: Date.now() + 5_000,
        },
      ]),
    );

    const fetchMock = vi.fn(async () => jsonResponse({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByText("Translating")).toBeTruthy();
      expect(screen.getByDisplayValue("https://restore.example.com")).toBeTruthy();
    });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("falls back to status polling when EventSource is unavailable", async () => {
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

  it("closes SSE and uses a single status check when stream errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "44444444-4444-4444-4444-444444444444",
          statusToken: "sse-token",
          status: "pending",
        });
      }
      if (url === "/api/previews/44444444-4444-4444-4444-444444444444?token=sse-token") {
        return jsonResponse({ status: "processing" });
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
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const stream = MockEventSource.instances[0];
    stream.emit("error");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/44444444-4444-4444-4444-444444444444?token=sse-token",
      );
    });
    expect(stream.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("uses stage copy from the shared resolver", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "55555555-5555-5555-5555-555555555555",
          statusToken: "stage-token",
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
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("progress", {
      status: "processing",
      stage: "translating",
    });

    await waitFor(() => {
      expect(screen.getByText("Translating")).toBeTruthy();
    });
  });

  it("allows resubmission when restored job is expired", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://expired.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "66666666-6666-6666-6666-666666666666",
          requestKey,
          statusToken: "expired-token",
          sourceUrl: "https://expired.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "expired",
          stage: null,
          previewUrl: null,
          error: "Preview expired",
          errorCode: "preview_expired",
          errorStage: "generating_preview",
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
          expiresAt: now - 1_000,
          retryCount: 0,
          nextPollAt: Number.POSITIVE_INFINITY,
        },
      ]),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return jsonResponse({
          previewId: "77777777-7777-7777-7777-777777777777",
          statusToken: "next-token",
          status: "pending",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://expired.example.com")).toBeTruthy();
    });

    const button = screen.getByRole("button", { name: "Generate preview" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
