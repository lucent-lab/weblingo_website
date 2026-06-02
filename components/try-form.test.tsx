// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import { ANALYTICS_EVENTS } from "@internal/analytics/client";
import type { SupportedLanguage } from "@internal/dashboard/webhooks";
import { resolvePreviewStatusCenterMessage } from "@internal/previews/status-center-i18n";
import {
  buildPreviewStatusCenterRequestKey,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterJobsSnapshot,
  markPreviewStatusCenterJobTerminal,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  resetPreviewStatusCenterStoreForTests,
  upsertPreviewStatusCenterJob,
} from "@internal/previews/status-center-store";
import { TryForm, resolveTryFormMode } from "./try-form";

const { captureAnalyticsEvent } = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
}));
vi.mock("@internal/analytics/client", async () => {
  const actual = await vi.importActual<typeof import("@internal/analytics/client")>(
    "@internal/analytics/client",
  );
  return {
    ...actual,
    captureAnalyticsEvent,
  };
});

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
  "try.form.button": "Generate a private preview",
  "try.form.placeholder": "https://example.com",
  "try.form.urlLabel": "URL",
  "try.form.requestSummaryTitle": "Submitted request",
  "try.form.languageTitle": "Languages",
  "try.form.emailLabel": "Email",
  "try.form.emailPlaceholder": "you@example.com",
  "try.form.emailRequired": "Enter an email.",
  "try.form.emailInvalid": "Enter a valid email.",
  "try.form.invalidUrl": "Invalid URL",
  "try.form.sourceLabel": "Source language",
  "try.form.targetLabel": "Target language",
  "try.form.sameLanguage": "Pick a different target language",
  "try.status.creating": "Creating preview...",
  "try.status.capacityHint": "Capacity hint",
  "try.status.capacityEmailHint": "Capacity email hint",
  "try.status.providerCapacityHint": "Provider capacity hint",
  "try.status.providerCapacityEmailHint": "Provider capacity email hint",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing preview...",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity...",
  "try.status.restoring": "Checking preview status...",
  "try.status.processingHint": "Processing hint",
  "try.status.ready": "Ready",
  "try.progress.label": "Preview progress",
  "try.progress.queued": "Queued",
  "try.progress.fetching": "Fetching page",
  "try.progress.translating": "Translating",
  "try.progress.rendering": "Rendering preview",
  "try.progress.ready": "Ready",
  "try.status.timedOutNoEmail": "Processing is taking longer than expected.",
  "try.action.retry": "Retry preview",
  "try.action.startAnother": "Start another preview",
  "try.action.checkStatus": "Check status",
  "try.action.checkingStatus": "Checking status...",
  "try.pending.emailPrompt": "Get notified when your preview is ready",
  "try.pending.emailSubmit": "Email me",
  "try.pending.emailSubmitting": "Saving...",
  "try.pending.emailSaved": "We'll email you when it's ready.",
  "try.pending.emailError": "Could not save email. Try again.",
  "try.preview.linkLabel": "Preview link",
  "try.preview.showcaseLinkLabel": "Showcase link",
  "try.preview.open": "Open preview",
  "try.preview.openOverlay": "Open overlay preview",
  "try.preview.viewShowcase": "View showcase",
  "try.preview.openDemoDashboard": "Open demo dashboard",
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

function storeRestoredActiveJob(
  overrides: Partial<Record<string, unknown>> & {
    previewId?: string;
    requestKey?: string;
    statusToken?: string;
    sourceUrl?: string;
    sourceLang?: string;
    targetLang?: string;
    status?: "pending" | "processing" | "waiting_provider_capacity";
    stage?: string | null;
  } = {},
) {
  const now = Date.now();
  const sourceUrl = overrides.sourceUrl ?? "https://restore.example.com";
  const sourceLang = overrides.sourceLang ?? "en";
  const targetLang = overrides.targetLang ?? "fr";
  const createdAt = typeof overrides.createdAt === "number" ? overrides.createdAt : now - 2_000;
  const updatedAt = typeof overrides.updatedAt === "number" ? overrides.updatedAt : now - 1_000;
  window.localStorage.setItem(
    PREVIEW_STATUS_CENTER_STORAGE_KEY,
    JSON.stringify([
      {
        previewId: overrides.previewId ?? "restore-1111-1111-1111-111111111111",
        requestKey:
          overrides.requestKey ??
          buildPreviewStatusCenterRequestKey({
            sourceUrl,
            sourceLang,
            targetLang,
          }),
        statusToken: overrides.statusToken ?? "restore-token",
        sourceUrl,
        sourceLang,
        targetLang,
        status: overrides.status ?? "processing",
        stage: overrides.stage ?? "translating",
        previewUrl: null,
        error: null,
        errorCode: null,
        errorStage: null,
        retryHint: overrides.retryHint ?? null,
        createdAt,
        updatedAt,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: now + 5_000,
      },
    ]),
  );
}

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  resetPreviewStatusCenterStoreForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  captureAnalyticsEvent.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPreviewStatusCenterStoreForTests();
  globalThis.EventSource = originalEventSource;
});

describe("TryForm preview status", () => {
  it("captures try form start, submit, create success, and terminal ready lifecycle events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          prospectShowcaseRef: "99999999-9999-9999-9999-999999999999",
          statusToken: "status-token",
          status: "processing",
          stage: "translating",
        }),
      ),
    );

    renderTryForm();

    const urlInput = screen.getByPlaceholderText("https://example.com");
    fireEvent.change(urlInput, { target: { value: "https://example.com/docs?secret=1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.tryFormStarted,
        expect.objectContaining({
          source_host: "example.com",
          source_path: "/docs",
          source_lang: "en",
          target_lang: "fr",
        }),
      );
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.tryFormSubmitted,
        expect.objectContaining({
          source_host: "example.com",
          source_path: "/docs",
        }),
      );
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewCreateSucceeded,
        expect.objectContaining({
          preview_id: "99999999-9999-9999-9999-999999999999",
          status: "processing",
          stage: "translating",
        }),
      );
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewStatusTransition,
        expect.objectContaining({
          preview_id: "99999999-9999-9999-9999-999999999999",
          status: "processing",
          stage: "translating",
        }),
      );
    });

    const eventSource = MockEventSource.instances[0];
    expect(eventSource).toBeTruthy();
    eventSource?.emit("complete", {
      showcaseUrl: "https://preview.example.com/p/9999",
    });

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewReady,
        expect.objectContaining({
          preview_id: "99999999-9999-9999-9999-999999999999",
          status: "ready",
        }),
      );
    });

    eventSource?.emit("complete", {
      showcaseUrl: "https://preview.example.com/p/9999",
    });
    await Promise.resolve();
    expect(
      captureAnalyticsEvent.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.previewReady),
    ).toHaveLength(1);
  });

  it("renders visible funnel labels and sends the email with the preview request", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        prospectShowcaseRef: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        statusToken: "email-token",
        status: "processing",
        stage: "translating",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        showEmailField
        fieldLayout="funnel"
      />,
    );

    expect(screen.getByLabelText("URL")).toBeTruthy();
    expect(screen.getByLabelText("Source language")).toBeTruthy();
    expect(screen.getByLabelText("Target language")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    const generateButton = screen.getByRole("button", {
      name: "Generate a private preview",
    }) as HTMLButtonElement;
    expect(generateButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://launch.example.com/public-page" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    expect(generateButton.disabled).toBe(false);

    fireEvent.click(generateButton);

    await waitFor(() => {
      const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(requestInit.body))).toMatchObject({
        sourceUrl: "https://launch.example.com/public-page",
        sourceLang: "en",
        targetLang: "fr",
        locale: "en",
        email: "owner@example.com",
      });
    });
    await waitFor(() => {
      expect(getPreviewStatusCenterJobsSnapshot()[0]?.requestKey).toBe(
        buildPreviewStatusCenterRequestKey({
          kind: "prospect_showcase",
          sourceUrl: "https://launch.example.com/public-page",
          sourceLang: "en",
          targetLang: "fr",
          email: "owner@example.com",
        }),
      );
    });
  });

  it("captures preview terminal failures from the create response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          prospectShowcaseRef: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          statusToken: "status-token",
          status: "failed",
          errorCode: "render_failed",
          errorStage: "generating_preview",
        }),
      ),
    );

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://broken.example.com/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewCreateSucceeded,
        expect.objectContaining({
          preview_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        }),
      );
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewFailed,
        expect.objectContaining({
          preview_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          status: "failed",
          error_code: "render_failed",
          error_stage: "generating_preview",
        }),
      );
    });
  });

  it("captures preview create failures when a 2xx response body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewCreateFailed,
        expect.objectContaining({
          source_host: "example.com",
          source_path: "/docs",
          source_lang: "en",
          target_lang: "fr",
        }),
      );
    });
  });

  it("does not double-count preview create failures for malformed success payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          status: "processing",
          statusToken: "status-token",
        }),
      ),
    );

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(
        captureAnalyticsEvent.mock.calls.filter(
          ([event]) => event === ANALYTICS_EVENTS.previewCreateFailed,
        ),
      ).toHaveLength(1);
    });
  });

  it("captures preview open and copy actions after a ready result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          prospectShowcaseRef: "abababab-abab-abab-abab-abababababab",
          statusToken: "status-token",
          status: "ready",
          showcaseUrl: "https://preview.example.com/p/abab",
        }),
      ),
    );
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    const openButton = await screen.findByRole("link", { name: "View showcase" });
    openButton.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(openButton);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewOpenClicked,
        expect.objectContaining({
          preview_id: "abababab-abab-abab-abab-abababababab",
        }),
      );
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewCopyClicked,
        expect.objectContaining({
          preview_id: "abababab-abab-abab-abab-abababababab",
        }),
      );
    });
  });

  it("does not re-emit try form started on a retry attempt after a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: "Preview failed.",
          },
          500,
        ),
      ),
    );

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));

    await waitFor(() => {
      expect(
        captureAnalyticsEvent.mock.calls.filter(
          ([event]) => event === ANALYTICS_EVENTS.tryFormStarted,
        ),
      ).toHaveLength(1);
    });
  });

  it("clears a stale ready result when a retry create request fails", async () => {
    upsertDefaultJob("pending", {
      previewId: "bcbc2222-2222-2222-2222-222222222222",
      previewUrl: "https://preview.example.com/p/ready",
    });
    markPreviewStatusCenterJobTerminal("bcbc2222-2222-2222-2222-222222222222", "ready", {
      previewUrl: "https://preview.example.com/p/ready",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: "Fresh request failed.",
          },
          500,
        ),
      ),
    );

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByRole("link", { name: "View showcase" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(screen.getByText("Fresh request failed.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
    });
    expect(screen.queryByText("Ready")).toBeNull();
    expect(screen.queryByRole("link", { name: "View showcase" })).toBeNull();
  });

  it("maps preview phases to deterministic modes", () => {
    expect(resolveTryFormMode(false, null)).toBe("idle");
    expect(resolveTryFormMode(true, null)).toBe("creating");

    expect(
      resolveTryFormMode(false, {
        kind: "preview",
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
        retryHint: null,
        remoteStatusVerified: true,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("running_pending");
    expect(
      resolveTryFormMode(false, {
        kind: "preview",
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
        retryHint: null,
        remoteStatusVerified: true,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("running_processing");
    expect(
      resolveTryFormMode(false, {
        kind: "preview",
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
        retryHint: null,
        remoteStatusVerified: true,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("terminal_ready");
    expect(
      resolveTryFormMode(false, {
        kind: "preview",
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
        retryHint: null,
        remoteStatusVerified: true,
        createdAt: 1,
        updatedAt: 1,
        expiresAt: null,
        retryCount: 0,
        nextPollAt: 1,
      }),
    ).toBe("terminal_failed");
    expect(
      resolveTryFormMode(false, {
        kind: "preview",
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
        retryHint: null,
        remoteStatusVerified: true,
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
    expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
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

    const generateButton = screen.getByRole("button", { name: "Generate a private preview" });
    expect(generateButton.className.includes("landing-button-micro")).toBe(true);
  });

  it("shows summary while restoring a running job", async () => {
    let resolveStatus: (value: Response) => void = () => undefined;
    const statusPromise = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    const fetchMock = vi.fn(async () => statusPromise);
    vi.stubGlobal("fetch", fetchMock);

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
      expect(screen.getByText("Checking preview status...")).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
      expect(screen.queryByRole("button", { name: "Generate a private preview" })).toBeNull();
      expect(screen.queryAllByTestId("mock-language-combobox")).toHaveLength(0);
      expect(screen.getByText("restore.example.com • English -> French")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Start another preview" })).toBeNull();
    });

    resolveStatus(jsonResponse({ status: "processing", stage: "translating" }));

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Start another preview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start another preview" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.queryByRole("list", { name: "Preview progress" })).toBeNull();
    });
  });

  it("renders a terminal restored-session error before allowing another preview", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "not-found-2222-2222-2222-222222222222",
      sourceUrl: "https://missing.example.com",
    });

    renderTryForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/not-found-2222-2222-2222-222222222222?token=restore-token",
      );
      expect(screen.getByText("Preview not found")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Start another preview" })).toBeNull();
    });
  });

  it("prefers the tab-pinned fresh preview over an older active preview on refresh", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ status: "processing", stage: "fetching_page" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    const staleRequestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://stale.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    const freshRequestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://fresh.example.com",
      sourceLang: "en",
      targetLang: "fr",
    });
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "stale-4444-4444-4444-444444444444",
          requestKey: staleRequestKey,
          statusToken: "stale-token",
          sourceUrl: "https://stale.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "processing",
          stage: "translating",
          previewUrl: null,
          error: null,
          errorCode: null,
          errorStage: null,
          createdAt: now - 60 * 60 * 1000,
          updatedAt: now + 1_000,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: now + 5_000,
        },
        {
          previewId: "fresh-5555-5555-5555-555555555555",
          requestKey: freshRequestKey,
          statusToken: "fresh-token",
          sourceUrl: "https://fresh.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "processing",
          stage: "fetching_page",
          previewUrl: null,
          error: null,
          errorCode: null,
          errorStage: null,
          createdAt: now - 5_000,
          updatedAt: now - 4_000,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: now + 5_000,
        },
      ]),
    );
    window.sessionStorage.setItem(
      "weblingo:try-form:active-preview-id:v1",
      "fresh-5555-5555-5555-555555555555",
    );

    renderTryForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/fresh-5555-5555-5555-555555555555?token=fresh-token",
      );
      expect(screen.getByText("fresh.example.com • English -> French")).toBeTruthy();
      expect(screen.queryByText("stale.example.com • English -> French")).toBeNull();
    });
  });

  it("does not let an old active preview take over an empty form on refresh", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    storeRestoredActiveJob({
      previewId: "old-6666-6666-6666-666666666666",
      sourceUrl: "https://old.example.com",
      createdAt: now - 60 * 60 * 1000,
      updatedAt: now,
    });

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.queryByText("old.example.com • English -> French")).toBeNull();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows retry and escape actions when restored status fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(jsonResponse({ status: "processing", stage: "translating" }));
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "transient-3333-3333-3333-333333333333",
      sourceUrl: "https://transient.example.com",
    });

    renderTryForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/transient-3333-3333-3333-333333333333?token=restore-token",
      );
      expect(screen.getByText("Checking preview status...")).toBeTruthy();
      expect(screen.queryByRole("list", { name: "Preview progress" })).toBeNull();
      expect(screen.getByRole("button", { name: "Check status" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Start another preview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Start another preview" })).toBeTruthy();
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
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
        "https://preview.example.com/p/ready",
      );
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
      expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
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
      if (url === "/api/prospect-showcases") {
        return createPromise;
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(screen.getByText("Creating preview...")).toBeTruthy();
      expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Queued");
      expect(screen.queryByRole("button", { name: "Open preview" })).toBeNull();
    });

    resolveCreate(
      jsonResponse({
        prospectShowcaseRef: "ffff6666-6666-6666-6666-666666666666",
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
          kind: "preview",
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
          retryHint: null,
          remoteStatusVerified: true,
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
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "11111111-1111-1111-1111-111111111111",
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
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

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
      showcaseUrl: "https://preview.test/p/abc",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByDisplayValue("https://preview.test/p/abc")).toBeTruthy();
    });
  });

  it("persists and renders a demo dashboard link when SSE completes without a showcase URL", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-dashboard-only",
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
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("complete", {
      status: "ready",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=dashboard-token",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "View showcase" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open demo dashboard" }).getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo#token=dashboard-token",
    );
  });

  it("delays status polling from provider-capacity retry hints received over SSE", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "11111111-1111-1111-1111-111111111111",
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
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const beforeStatus = Date.now();
    MockEventSource.instances[0].emit("status", {
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: true,
      },
    });

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "11111111-1111-1111-1111-111111111111",
      );
      expect(job?.status).toBe("waiting_provider_capacity");
      expect(job?.nextPollAt).toBeGreaterThanOrEqual(beforeStatus + 30_000);
    });
  });

  it("resumes normal status polling when SSE leaves provider-capacity wait", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "11111111-1111-1111-1111-111111111111",
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
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("status", {
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 60,
        emailRecommended: true,
      },
    });

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "11111111-1111-1111-1111-111111111111",
      );
      expect(job?.status).toBe("waiting_provider_capacity");
      expect(job?.nextPollAt).toBeGreaterThanOrEqual(Date.now() + 55_000);
    });

    const beforeProcessing = Date.now();
    MockEventSource.instances[0].emit("status", {
      status: "processing",
      stage: "translating",
      retryHint: null,
    });

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "11111111-1111-1111-1111-111111111111",
      );
      expect(job?.status).toBe("processing");
      expect(job?.retryHint).toBeNull();
      expect(job?.nextPollAt).toBeGreaterThanOrEqual(
        beforeProcessing + DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
      );
      expect(job?.nextPollAt).toBeLessThan(beforeProcessing + 60_000);
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
      expect(screen.queryByRole("button", { name: "Generate a private preview" })).toBeNull();
      expect(screen.queryAllByTestId("mock-language-combobox")).toHaveLength(0);
      expect(screen.getByText("restore.example.com • English -> French")).toBeTruthy();
    });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("restores email-scoped prospect showcase jobs with their submitted email", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      kind: "prospect_showcase",
      sourceUrl: "https://restore.example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    });
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          kind: "prospect_showcase",
          previewId: "prospect-restore-2222-2222-2222-222222222222",
          requestKey,
          statusToken: "restore-token",
          sourceUrl: "https://restore.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "ready",
          stage: null,
          previewUrl: "https://showcase.example.com",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo",
          error: null,
          errorCode: null,
          errorStage: null,
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: Number.POSITIVE_INFINITY,
        },
      ]),
    );

    render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        showEmailField
        fieldLayout="funnel"
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("https://restore.example.com")).toBeTruthy();
      expect(screen.getByDisplayValue("owner@example.com")).toBeTruthy();
      expect(getPreviewStatusCenterJobsSnapshot()[0]?.requestKey).toBe(requestKey);
    });
  });

  it("checks restored provider-capacity waits on mount", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: "waiting_provider_capacity",
        stage: "translating",
        retryHint: {
          reason: "provider_capacity_wait",
          retryAfterSeconds: 60,
          emailRecommended: false,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const beforeStatus = Date.now();
    storeRestoredActiveJob({
      previewId: "waiting-7777-7777-7777-777777777777",
      statusToken: "waiting-token",
      sourceUrl: "https://waiting.example.com",
      status: "waiting_provider_capacity",
      stage: "translating",
    });

    renderTryForm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/waiting-7777-7777-7777-777777777777?token=waiting-token",
      );
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.getByText("waiting.example.com • English -> French")).toBeTruthy();
    });
    const job = getPreviewStatusCenterJobsSnapshot().find(
      (entry) => entry.previewId === "waiting-7777-7777-7777-777777777777",
    );
    expect(job?.nextPollAt).toBeGreaterThanOrEqual(beforeStatus + 60_000);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("keeps restored provider-capacity waits visible when status checks fail transiently", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "waiting-transient-7777-7777-7777-777777777777",
      statusToken: "waiting-token",
      sourceUrl: "https://waiting.example.com",
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: true,
      },
    });

    renderTryForm();

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "waiting-transient-7777-7777-7777-777777777777",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/previews/waiting-transient-7777-7777-7777-777777777777?token=waiting-token",
      );
      expect(job?.status).toBe("waiting_provider_capacity");
      expect(job?.retryHint).toEqual({
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: true,
      });
      expect(job?.remoteStatusVerified).toBe(false);
      expect(screen.getByText("Waiting for translation capacity...")).toBeTruthy();
      expect(screen.getByText("Processing hint")).toBeTruthy();
      expect(screen.queryByText("Provider capacity email hint")).toBeNull();
    });
  });

  it("tracks restored previews and later terminal transitions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "processing" })),
    );

    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "restored-analytics-2222-2222-2222-222222222222",
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

    renderTryForm();

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewStatusTransition,
        expect.objectContaining({
          preview_id: "restored-analytics-2222-2222-2222-222222222222",
          stage: "translating",
          status: "processing",
        }),
      );
    });

    markPreviewStatusCenterJobTerminal("restored-analytics-2222-2222-2222-222222222222", "ready", {
      previewUrl: "https://preview.example.com/p/restored",
    });

    await waitFor(() => {
      expect(captureAnalyticsEvent).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.previewReady,
        expect.objectContaining({
          preview_id: "restored-analytics-2222-2222-2222-222222222222",
          status: "ready",
        }),
      );
    });
  });

  it("does not report aborted preview create requests as failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) !== "/api/prospect-showcases") {
          return Promise.resolve(jsonResponse({ status: "processing" }));
        }

        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true },
          );
        });
      }),
    );

    const rendered = render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        showEmailField={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(screen.getByText("Creating preview...")).toBeTruthy();
    });

    rendered.unmount();

    await Promise.resolve();

    expect(
      captureAnalyticsEvent.mock.calls.filter(
        ([event]) => event === ANALYTICS_EVENTS.previewCreateFailed,
      ),
    ).toHaveLength(0);
  });

  it("shows a basic request summary while a request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "pending" })),
    );

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "processing", stage: "translating" })),
    );

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

    expect(
      captureAnalyticsEvent.mock.calls.filter(
        ([event]) => event === ANALYTICS_EVENTS.tryFormStarted,
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Email me" }));

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

  it("does not show the legacy pending-email action for prospect showcase jobs", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);

    upsertPreviewStatusCenterJob({
      kind: "prospect_showcase",
      previewId: "prospect-email-5555-5555-5555-555555555555",
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
      expect(screen.getByText("summary.example.com • English -> French")).toBeTruthy();
    });
    expect(screen.queryByText("Get notified when your preview is ready")).toBeNull();
    expect(screen.queryByRole("button", { name: "Email me" })).toBeNull();
  });

  it("shows the capacity-specific processing hint when browser slots are full", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "capacity-6666-6666-6666-666666666666",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://capacity.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "capacity-token",
      sourceUrl: "https://capacity.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "processing",
      stage: "fetching_page",
      retryHint: {
        reason: "browser_capacity_exhausted",
        retryAfterSeconds: 60,
        emailRecommended: true,
      },
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
      expect(screen.getByText("Capacity email hint")).toBeTruthy();
    });
  });

  it("shows the capacity-specific processing hint when provider capacity is constrained", async () => {
    upsertPreviewStatusCenterJob({
      previewId: "provider-capacity-7777-7777-7777-777777777777",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://provider-capacity.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "provider-capacity-token",
      sourceUrl: "https://provider-capacity.example.com",
      sourceLang: "en",
      targetLang: "fr",
      status: "waiting_provider_capacity",
      stage: "translating",
      retryHint: {
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
        emailRecommended: false,
      },
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
      expect(screen.getByText("Provider capacity email hint")).toBeTruthy();
    });
  });

  it("falls back to status polling when EventSource is unavailable", async () => {
    vi.stubGlobal("EventSource", undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "33333333-3333-3333-3333-333333333333",
          statusToken: "poll-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/33333333-3333-3333-3333-333333333333/status?token=poll-token"
      ) {
        return jsonResponse({
          status: "ready",
          showcaseUrl: "https://preview.test/p/poll",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/33333333-3333-3333-3333-333333333333/status?token=poll-token",
      );
      expect(screen.getByText("Ready")).toBeTruthy();
    });
  });

  it("maps status polling 404 responses to preview-not-found copy", async () => {
    vi.stubGlobal("EventSource", undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "33333333-3333-3333-3333-333333333333",
          statusToken: "poll-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/33333333-3333-3333-3333-333333333333/status?token=poll-token"
      ) {
        return jsonResponse({ error: "Not found" }, 404);
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/33333333-3333-3333-3333-333333333333/status?token=poll-token",
      );
      expect(screen.getByText("Preview not found")).toBeTruthy();
    });
  });

  it("closes SSE and uses a single status check when stream errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "44444444-4444-4444-4444-444444444444",
          statusToken: "sse-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/44444444-4444-4444-4444-444444444444/status?token=sse-token"
      ) {
        return jsonResponse({ status: "processing" });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const stream = MockEventSource.instances[0];
    stream.emit("error");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/44444444-4444-4444-4444-444444444444/status?token=sse-token",
      );
    });
    expect(stream.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("restores running UI when a timed-out preview status check remains active", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "timeout-active-8888-8888-8888-888888888888",
          statusToken: "timeout-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/timeout-active-8888-8888-8888-888888888888/status?token=timeout-token"
      ) {
        return jsonResponse({ status: "waiting_provider_capacity", stage: "translating" });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("error");

    await waitFor(() => {
      expect(screen.getByText("Processing is taking longer than expected.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Check status" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() => {
      expect(screen.queryByText("Processing is taking longer than expected.")).toBeNull();
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.getByText("Waiting for translation capacity...")).toBeTruthy();
    });
  });

  it("uses stage copy from the shared resolver", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "55555555-5555-5555-5555-555555555555",
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
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

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
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "77777777-7777-7777-7777-777777777777",
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

    const button = screen.getByRole("button", { name: "Retry preview" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
