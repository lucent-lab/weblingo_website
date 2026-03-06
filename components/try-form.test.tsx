// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import { resolvePreviewStatusCenterMessage } from "@internal/previews/status-center-i18n";
import { TryForm, resolveTryFormMode } from "./try-form";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import {
  buildPreviewStatusCenterRequestKey,
  markPreviewStatusCenterJobTerminal,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
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
  "try.form.urlLabel": "URL",
  "try.form.requestSummaryTitle": "Submitted request",
  "try.form.languageTitle": "Languages",
  "try.form.emailPlaceholder": "you@example.com",
  "try.form.invalidUrl": "Invalid URL",
  "try.form.sourceLabel": "Source language",
  "try.form.targetLabel": "Target language",
  "try.form.sameLanguage": "Pick a different target language",
  "try.status.creating": "Creating preview...",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing preview...",
  "try.status.processingHint": "Processing hint",
  "try.status.ready": "Ready",
  "try.progress.label": "Preview progress",
  "try.progress.queued": "Queued",
  "try.progress.fetching": "Fetching page",
  "try.progress.translating": "Translating",
  "try.progress.rendering": "Rendering preview",
  "try.progress.ready": "Ready",
  "try.status.timedOutNoEmail": "Processing is taking longer than expected.",
  "try.action.checkStatus": "Check status",
  "try.action.checkingStatus": "Checking status...",
  "try.pending.emailPrompt": "Get notified when your preview is ready",
  "try.pending.emailSubmit": "Notify me",
  "try.pending.emailSubmitting": "Saving...",
  "try.pending.emailSaved": "We'll email you when it's ready.",
  "try.pending.emailError": "Could not save email. Try again.",
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

function upsertDefaultJob(
  status: "pending" | "processing",
  overrides: Partial<Parameters<typeof upsertPreviewStatusCenterJob>[0]> = {},
) {
  upsertPreviewStatusCenterJob({
    previewId: "aaaa1111-1111-1111-1111-111111111111",
    requestKey: buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
    }),
    statusToken: "status-token",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    targetLang: "fr",
    status,
    ...overrides,
  });
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
  it("maps preview phases to deterministic modes", () => {
    expect(resolveTryFormMode(false, null)).toBe("idle");
    expect(resolveTryFormMode(true, null)).toBe("creating");

    expect(
      resolveTryFormMode(false, {
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: "pending",
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("running_pending");
    expect(
      resolveTryFormMode(false, {
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: "processing",
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("running_processing");
    expect(
      resolveTryFormMode(false, {
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: "ready",
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("terminal_ready");
    expect(
      resolveTryFormMode(false, {
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: "failed",
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("terminal_failed");
    expect(
      resolveTryFormMode(false, {
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: "expired",
        stage: null,
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("terminal_expired");
  });

  it("shows editable controls in idle mode", () => {
    renderTryForm();
    expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate preview" })).toBeTruthy();
    expect(screen.getAllByTestId("mock-language-combobox")).toHaveLength(2);
  });

  it("applies custom primary button classes when provided", () => {
    render(
      <TryForm
        locale="en"
        messages={messages}
        primaryButtonClassName="landing-button-micro"
        supportedLanguages={supportedLanguages}
        showEmailField={false}
      />,
    );

    const generateButton = screen.getByRole("button", { name: "Generate preview" });
    expect(generateButton.className.includes("landing-button-micro")).toBe(true);
  });

  it("shows summary while restoring a running job", async () => {
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "bbbb2222-2222-2222-2222-222222222222",
          requestKey: buildPreviewStatusCenterRequestKey({
            sourceUrl: "https://restore.example.com",
            sourceLang: "en",
            targetLang: "fr",
          }),
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
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: now + 5_000,
        },
      ]),
    );

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
      expect(screen.queryByRole("button", { name: "Generate preview" })).toBeNull();
      expect(screen.queryAllByTestId("mock-language-combobox")).toHaveLength(0);
      expect(screen.getByText("restore.example.com • English -> French")).toBeTruthy();
    });
  });

  it("restores editable controls for terminal ready and failed states", async () => {
    upsertDefaultJob("pending", {
      previewId: "cccc3333-3333-3333-3333-333333333333",
      previewUrl: "https://preview.example.com/p/ready",
    });
    markPreviewStatusCenterJobTerminal("cccc3333-3333-3333-3333-333333333333", "ready", {
      previewUrl: "https://preview.example.com/p/ready",
    });

    renderTryForm();
    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate preview" })).toBeTruthy();
    });

    cleanup();
    resetPreviewStatusCenterStoreForTests();
    upsertDefaultJob("pending", {
      previewId: "dddd4444-4444-4444-4444-444444444444",
    });
    markPreviewStatusCenterJobTerminal("dddd4444-4444-4444-4444-444444444444", "failed", {
      error: "Preview failed.",
      errorCode: "unknown",
      errorStage: "generating_preview",
    });

    renderTryForm();
    await waitFor(() => {
      expect(screen.getByText("Unknown error")).toBeTruthy();
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate preview" })).toBeTruthy();
    });
  });

  it("keeps creating copy for new request scope until matching persisted job appears", async () => {
    upsertDefaultJob("pending", {
      previewId: "eeee5555-5555-5555-5555-555555555555",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://old.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      sourceUrl: "https://old.example.com",
    });
    markPreviewStatusCenterJobTerminal("eeee5555-5555-5555-5555-555555555555", "ready", {
      previewUrl: "https://preview.example.com/old",
    });

    let resolveCreate: (value: Response) => void = () => undefined;
    const createPromise = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/previews") {
        return createPromise;
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));

    await waitFor(() => {
      expect(screen.getByText("Creating preview...")).toBeTruthy();
      expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Queued");
      expect(screen.queryByRole("button", { name: "Open preview" })).toBeNull();
    });

    resolveCreate(
      jsonResponse({
        previewId: "ffff6666-6666-6666-6666-666666666666",
        statusToken: "new-token",
        status: "pending",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Creating preview...")).toBeNull();
      expect(screen.getByText("Pending")).toBeTruthy();
    });
  });

  it("keeps TryForm and status center copy aligned for all persisted phases", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://parity.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    const phases = [
      { status: "pending" as const, stage: "translating" as const },
      { status: "processing" as const, stage: null },
      { status: "ready" as const, stage: null },
      { status: "failed" as const, stage: null },
      { status: "expired" as const, stage: null },
    ];

    for (const phase of phases) {
      cleanup();
      resetPreviewStatusCenterStoreForTests();
      window.localStorage.clear();

      upsertPreviewStatusCenterJob({
        previewId: `phase-${phase.status}`,
        requestKey,
        statusToken: `token-${phase.status}`,
        sourceUrl: "https://parity.example.com",
        sourceLang: "en",
        targetLang: "fr",
        status: phase.status,
        stage: phase.stage,
        error: phase.status === "failed" ? "Preview failed." : null,
        errorCode:
          phase.status === "failed"
            ? "unknown"
            : phase.status === "expired"
              ? "preview_expired"
              : null,
        errorStage: phase.status === "failed" ? "generating_preview" : null,
      });

      render(
        <>
          <TryForm
            locale="en"
            messages={messages}
            supportedLanguages={supportedLanguages}
            showEmailField={false}
          />
          <PreviewStatusCenter messages={messages} />
        </>,
      );

      const expected = resolvePreviewStatusCenterMessage(
        {
          previewId: `phase-${phase.status}`,
          requestKey,
          statusToken: `token-${phase.status}`,
          sourceUrl: "https://parity.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: phase.status,
          stage: phase.stage,
          previewUrl: null,
          error: phase.status === "failed" ? "Preview failed." : null,
          errorCode:
            phase.status === "failed"
              ? "unknown"
              : phase.status === "expired"
                ? "preview_expired"
                : null,
          errorStage: phase.status === "failed" ? "generating_preview" : null,
          createdAt: 1,
          updatedAt: 1,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: 1,
        },
        (key) => messages[key as keyof typeof messages] ?? key,
      );

      await waitFor(() => {
        expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(2);
      });
    }
  });

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
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
      expect(screen.queryByRole("button", { name: "Generate preview" })).toBeNull();
      expect(screen.queryAllByTestId("mock-language-combobox")).toHaveLength(0);
      expect(screen.getByText("restore.example.com • English -> French")).toBeTruthy();
    });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("shows a basic request summary while a request is in flight", async () => {
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "summary5555-5555-5555-5555-555555555555",
          requestKey: buildPreviewStatusCenterRequestKey({
            sourceUrl: "https://summary.example.com",
            sourceLang: "en",
            targetLang: "fr",
          }),
          statusToken: "summary-token",
          sourceUrl: "https://summary.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "pending",
          stage: null,
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

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeTruthy();
      expect(screen.getByText("summary.example.com • English -> French")).toBeTruthy();
    });
  });

  it("renders a compact progress stepper for running previews", async () => {
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "stepper555-5555-5555-5555-555555555555",
          requestKey: buildPreviewStatusCenterRequestKey({
            sourceUrl: "https://stepper.example.com",
            sourceLang: "en",
            targetLang: "fr",
          }),
          statusToken: "stepper-token",
          sourceUrl: "https://stepper.example.com",
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

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
    });

    const progressList = screen.getByRole("list", { name: "Preview progress" });
    expect(progressList).toBeTruthy();
    expect(screen.getByText("stepper.example.com • English -> French")).toBeTruthy();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");
    expect(screen.getByText("Queued")).toBeTruthy();
    expect(screen.getByText("Fetching page")).toBeTruthy();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
  });

  it("submits a pending preview email while the preview is running", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    upsertPreviewStatusCenterJob({
      previewId: "pending-email-5555-5555-5555-555555555555",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://summary.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "summary-token",
      sourceUrl: "https://summary.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "pending",
      stage: "translating",
    });

    render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        showEmailField
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Get notified when your preview is ready")).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/pending-email-5555-5555-5555-555555555555?token=summary-token",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "owner@example.com" }),
        }),
      );
      expect(screen.getByText("We'll email you when it's ready.")).toBeTruthy();
    });
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
