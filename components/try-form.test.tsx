// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewStatusCenter } from "./preview-status-center";
import { ANALYTICS_EVENTS } from "@internal/analytics/client";
import type { SupportedLanguage } from "@internal/dashboard/webhook-contracts";
import { resolvePreviewStatusCenterMessage } from "@internal/previews/status-center-i18n";
import {
  buildPreviewStatusCenterRequestKey,
  DEFAULT_PREVIEW_STATUS_CENTER_POLL_INTERVAL_MS,
  getPreviewStatusCenterJobsSnapshot,
  markPreviewStatusCenterJobTerminal,
  PREVIEW_ACTIVE_JOB_MAX_AGE_MS,
  PREVIEW_STATUS_CENTER_STORAGE_KEY,
  resetPreviewStatusCenterStoreForTests,
  updatePreviewStatusCenterJob,
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
  "try.form.emailHint": "We email you the links when it's ready.",
  "try.status.creating": "Creating preview...",
  "try.status.capacityHint": "Capacity hint",
  "try.status.providerCapacityHint": "Provider capacity hint",
  "try.status.pending": "Pending",
  "try.status.processing": "Processing preview...",
  "try.status.waitingProviderCapacity": "Waiting for translation capacity...",
  "try.status.restoring": "Checking preview status...",
  "try.status.processingHint": "Processing hint",
  "try.status.emailNotice": "Usually ready in a few minutes. We'll email the links to {email}.",
  "try.status.statusUnreachable": "We can't check the preview status right now.",
  "try.status.pendingEmail": "We'll email {email} when your preview is ready.",
  "try.status.ready": "Ready",
  "try.progress.label": "Preview progress",
  "try.progress.queued": "Queued",
  "try.progress.fetching": "Fetching page",
  "try.progress.translating": "Translating",
  "try.progress.rendering": "Rendering preview",
  "try.progress.ready": "Ready",
  "try.action.retry": "Retry preview",
  "try.action.translateAnother": "Translate another page",
  "try.action.checkStatus": "Check status",
  "try.action.checkingStatus": "Checking status...",
  "try.action.startNewPreview": "Start a new preview",
  "try.error.previewInProgress": "A demo is already being prepared for {email}.",
  "try.preview.linkLabel": "Preview link",
  "try.preview.showcaseLinkLabel": "Showcase link",
  "try.preview.open": "Open preview",
  "try.preview.openOverlay": "Open overlay preview",
  "try.preview.viewShowcase": "View showcase",
  "try.preview.openDemoDashboard": "Open demo dashboard",
  "try.preview.copy": "Copy link",
  "try.preview.copied": "Copied",
  "try.preview.emailedNotice": "We also emailed these links to {email}.",
  "try.error.default": "Preview failed.",
  "try.error.stageLabel": "Failed during {stage}",
  "try.error.referenceHint": "If you contact support, include reference {ref}.",
  "try.error.preview_expired": "Preview expired",
  "try.error.preview_not_found": "Preview not found",
  "try.error.provision_failed": "Provision failed copy",
  "try.error.translation_failed": "Translation failed copy",
  "try.error.showcase_failed": "Showcase failed copy",
  "try.error.provision_stalled": "Provision stalled copy",
  "try.error.processing_stalled": "Processing stalled copy",
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

function renderTryForm(locale = "en") {
  render(
    <TryForm
      locale={locale}
      messages={messages}
      supportedLanguages={supportedLanguages}
      disabled={false}
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
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
        disabled={false}
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
          sourceUrl: "https://launch.example.com/public-page",
          sourceLang: "en",
          targetLang: "fr",
          email: "owner@example.com",
        }),
      );
    });
  });

  it("sends the stored status token as reattach proof for an identical in-flight submission", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          prospectShowcaseRef: "reattach-1111-1111-1111-111111111111",
          statusToken: "rotated-token",
          status: "processing",
          stage: "translating",
          message: "Reconnecting to the existing demo.",
        },
        202,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Active job from an earlier session: old enough that the restore effect
    // does not lock the form, but still in flight with a stored status token.
    storeRestoredActiveJob({
      previewId: "reattach-1111-1111-1111-111111111111",
      sourceUrl: "https://reattach.example.com/page",
      statusToken: "proof-token",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://reattach.example.com/page",
        sourceLang: "en",
        targetLang: "fr",
        email: "owner@example.com",
      }),
      createdAt: Date.now() - 16 * 60 * 1000,
      updatedAt: Date.now() - 16 * 60 * 1000,
    });

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://reattach.example.com/page" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      const createCall = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(
        (call) => String(call[0]) === "/api/prospect-showcases",
      );
      expect(createCall).toBeTruthy();
      expect(JSON.parse(String(createCall![1].body))).toMatchObject({
        sourceUrl: "https://reattach.example.com/page",
        email: "owner@example.com",
        reattachStatusToken: "proof-token",
      });
    });
  });

  it("explains an in-progress duplicate when the create endpoint answers 409 without proof", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases") {
        return jsonResponse(
          {
            error: "A demo for this page and language pair is already being prepared.",
            errorCode: "preview_in_progress",
          },
          409,
        );
      }
      return jsonResponse({ status: "processing", stage: "translating" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://duplicate.example.com/page" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(
        screen.getByText("A demo is already being prepared for owner@example.com."),
      ).toBeTruthy();
    });
    // No phantom job was created locally and the form stays editable.
    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(0);
    expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
  });

  it("clears a stale local reattach job when the create endpoint rejects its proof", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://duplicate.example.com/page",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases") {
        return jsonResponse(
          {
            error: "A demo for this page and language pair is already being prepared.",
            errorCode: "preview_in_progress",
          },
          409,
        );
      }
      return jsonResponse({ status: "processing", stage: "translating" });
    });
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "stale-reattach-1111-1111-1111-111111111111",
      requestKey,
      sourceUrl: "https://duplicate.example.com/page",
      statusToken: "stale-proof-token",
      createdAt: Date.now() - 16 * 60 * 1000,
      updatedAt: Date.now() - 16 * 60 * 1000,
    });

    renderTryForm();

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://duplicate.example.com/page" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      const createCall = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(
        (call) => String(call[0]) === "/api/prospect-showcases",
      );
      expect(createCall).toBeTruthy();
      expect(JSON.parse(String(createCall![1].body))).toMatchObject({
        reattachStatusToken: "stale-proof-token",
      });
      expect(
        screen.getByText("A demo is already being prepared for owner@example.com."),
      ).toBeTruthy();
    });
    expect(
      getPreviewStatusCenterJobsSnapshot().some(
        (job) => job.previewId === "stale-reattach-1111-1111-1111-111111111111",
      ),
    ).toBe(false);
    expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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

  it("clears a stale ready result when a fresh create request fails", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://fresh.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
        previewId: "1",
        requestKey: "k",
        statusToken: "t",
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: 1,
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
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: 1,
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
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: 1,
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
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: 1,
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
        statusTokenUpdatedAt: 0,
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
        lastVerifiedAt: 1,
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
        disabled={false}
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

    // Once the run is verified the stepper appears, and no mid-run reset action exists.
    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Start another preview" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Translate another page" })).toBeNull();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
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
        "/api/prospect-showcases/not-found-2222-2222-2222-222222222222/status?token=restore-token",
      );
      expect(screen.getByText("Preview not found")).toBeTruthy();
      expect(
        screen.getByText(
          "If you contact support, include reference not-found-2222-2222-2222-222222222222.",
        ),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.queryByText("Preview not found")).toBeNull();
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
          createdAt: now - PREVIEW_ACTIVE_JOB_MAX_AGE_MS - 60_000,
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
        "/api/prospect-showcases/fresh-5555-5555-5555-555555555555/status?token=fresh-token",
      );
      expect(screen.getByText("fresh.example.com • English -> French")).toBeTruthy();
      expect(screen.queryByText("stale.example.com • English -> French")).toBeNull();
    });
  });

  it("restores the server verdict for an over-budget pinned preview instead of stale-failing it", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        status: "ready",
        showcaseUrl: "https://showcase.example.com/p/old",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    storeRestoredActiveJob({
      previewId: "old-6666-6666-6666-666666666666",
      sourceUrl: "https://old.example.com",
      createdAt: now - PREVIEW_ACTIVE_JOB_MAX_AGE_MS - 60_000,
      updatedAt: now,
    });
    window.sessionStorage.setItem(
      "weblingo:try-form:active-preview-id:v1",
      "old-6666-6666-6666-666666666666",
    );

    renderTryForm();

    // The backend completed the showcase while no tab was open, so the restored
    // job must surface the ready showcase instead of a fabricated stale failure.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/old-6666-6666-6666-666666666666/status?token=restore-token",
      );
      expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
        "https://showcase.example.com/p/old",
      );
    });
    expect(screen.queryByText("Processing stalled copy")).toBeNull();
  });

  it("surfaces the verdict of an over-age unpinned job once the runtime resolves it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "processing", stage: "translating" })),
    );
    const now = Date.now();
    // Reopened from persisted localStorage with no session pin: the job is past
    // the form-restore window but still active, so the one-shot restore skips it.
    storeRestoredActiveJob({
      previewId: "overage-7777-7777-7777-777777777777",
      sourceUrl: "https://overage.example.com",
      createdAt: now - 20 * 60 * 1000,
      updatedAt: now - 20 * 60 * 1000,
    });

    renderTryForm();

    expect(screen.queryByText("Checking preview status...")).toBeNull();

    // The shared status runtime polls the job to its verdict shortly after
    // load; the form must surface that outcome instead of letting it vanish.
    markPreviewStatusCenterJobTerminal("overage-7777-7777-7777-777777777777", "ready", {
      previewUrl: "https://preview.example.com/overage",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
        "https://preview.example.com/overage",
      );
    });
  });

  it("does not block terminal restore after a locally invalid submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    storeRestoredActiveJob({
      previewId: "invalid-restore-7777-7777-7777-777777777777",
      sourceUrl: "https://invalid-restore.example.com",
      createdAt: now - 20 * 60 * 1000,
      updatedAt: now - 20 * 60 * 1000,
    });

    renderTryForm();

    expect(screen.queryByText("Checking preview status...")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "not-a-url" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(screen.getAllByText("Invalid URL").length).toBeGreaterThan(0);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    markPreviewStatusCenterJobTerminal("invalid-restore-7777-7777-7777-777777777777", "ready", {
      previewUrl: "https://preview.example.com/invalid-restore",
    });

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeTruthy();
      expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
        "https://preview.example.com/invalid-restore",
      );
    });
  });

  it("shows a manual check-status retry when restored status fetch fails", async () => {
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
        "/api/prospect-showcases/transient-3333-3333-3333-333333333333/status?token=restore-token",
      );
      expect(screen.getByText("Checking preview status...")).toBeTruthy();
      expect(screen.queryByRole("list", { name: "Preview progress" })).toBeNull();
      expect(screen.getByRole("button", { name: "Check status" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Start another preview" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Check status" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
    });
  });

  it("lets the visitor escape an unverifiable restored job and start a new preview", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "escape-4444-4444-4444-444444444444",
      sourceUrl: "https://escape.example.com",
    });

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByText("Checking preview status...")).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
      expect(screen.getByRole("button", { name: "Start a new preview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start a new preview" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.queryByText("Checking preview status...")).toBeNull();
    });
    expect(
      getPreviewStatusCenterJobsSnapshot().some(
        (job) => job.previewId === "escape-4444-4444-4444-444444444444",
      ),
    ).toBe(false);
  });

  it("preserves reattach proof after escaping an unverifiable restored job", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://escape-reattach.example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url ===
        "/api/prospect-showcases/escape-reattach-4444-4444-4444-444444444444/status?token=restore-token"
      ) {
        throw new Error("network unavailable");
      }
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "escape-reattach-4444-4444-4444-444444444444",
          statusToken: "rotated-token",
          status: "processing",
          stage: "translating",
        });
      }
      return jsonResponse({ status: "processing", stage: "translating" });
    });
    vi.stubGlobal("fetch", fetchMock);
    storeRestoredActiveJob({
      previewId: "escape-reattach-4444-4444-4444-444444444444",
      requestKey,
      statusToken: "restore-token",
      sourceUrl: "https://escape-reattach.example.com",
    });

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start a new preview" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start a new preview" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
    });
    expect(getPreviewStatusCenterJobsSnapshot()).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://escape-reattach.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      const createCall = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(
        (call) => String(call[0]) === "/api/prospect-showcases",
      );
      expect(createCall).toBeTruthy();
      expect(JSON.parse(String(createCall![1].body))).toMatchObject({
        sourceUrl: "https://escape-reattach.example.com",
        email: "owner@example.com",
        reattachStatusToken: "restore-token",
      });
    });
  });

  it("renders terminal cards without the editable form and resets via translate-another", async () => {
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
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
      expect(screen.queryByRole("button", { name: "Generate a private preview" })).toBeNull();
      expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
        "https://preview.example.com/p/ready",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("https://example.com")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Generate a private preview" })).toBeTruthy();
      expect(screen.queryByText("Ready")).toBeNull();
    });

    cleanup();
    resetPreviewStatusCenterStoreForTests();
    window.sessionStorage.clear();
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
      expect(screen.getByRole("button", { name: "Translate another page" })).toBeTruthy();
      expect(screen.queryByPlaceholderText("https://example.com")).toBeNull();
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
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Translate another page" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://new.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
            disabled={false}
          />
          <PreviewStatusCenter messages={messages} />
        </>,
      );

      const isTerminalPhase =
        phase.status === "ready" || phase.status === "failed" || phase.status === "expired";
      const expected = resolvePreviewStatusCenterMessage(
        {
          previewId: `phase-${phase.status}`,
          requestKey,
          statusToken: `token-${phase.status}`,
          statusTokenUpdatedAt: 0,
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
          lastVerifiedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          expiresAt: null,
          retryCount: 0,
          nextPollAt: 1,
        },
        (key) => messages[key as keyof typeof messages] ?? key,
      );

      // Active phases render the same copy in the form and the toast; terminal
      // outcomes are owned by the form only, so the toast renders nothing.
      await waitFor(() => {
        expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(
          isTerminalPhase ? 1 : 2,
        );
      });
      if (isTerminalPhase) {
        expect(screen.getAllByText(expected)).toHaveLength(1);
      }
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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

    renderTryForm("fr");
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
      "https://weblingo.app/dashboard/demo?locale=fr#token=dashboard-token",
    );
  });

  it("does not mark a prospect showcase ready from a complete frame without a ready payload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-complete-not-ready",
          statusToken: "status-token",
          status: "pending",
        });
      }
      return jsonResponse({
        status: "processing",
        stage: "building_showcase",
        message: "Building translated showcase.",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("complete", {
      status: "processing",
      stage: "building_showcase",
      message: "Building translated showcase.",
    });

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "prospect-complete-not-ready",
      );
      expect(job?.status).toBe("processing");
      expect(job?.stage).toBe("generating_preview");
    });
  });

  it("renders a demo dashboard continuation link when SSE reports payment failure", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-payment-failed",
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("status", {
      status: "payment_failed",
      message: "Payment failed. Retry checkout to continue activation.",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=payment-retry",
    });

    await waitFor(() => {
      expect(
        screen.getByText("Payment failed. Retry checkout to continue activation."),
      ).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "Open demo dashboard" }).getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo?locale=en#token=payment-retry",
    );
  });

  it("renders a showcase link when SSE payment failure includes a showcase url", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-payment-failed-showcase",
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("status", {
      status: "payment_failed",
      message: "Payment failed. Retry checkout to continue activation.",
      showcaseUrl: "https://showcase.example.com/payment-failed/fr",
    });

    await waitFor(() => {
      expect(
        screen.getByText("Payment failed. Retry checkout to continue activation."),
      ).toBeTruthy();
    });
    expect(screen.getByRole("link", { name: "View showcase" }).getAttribute("href")).toBe(
      "https://showcase.example.com/payment-failed/fr",
    );
  });

  it("does not mark prospect showcase complete frames with payment failure as ready", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-complete-payment-failed",
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("complete", {
      status: "payment_failed",
      message: "Payment failed. Retry checkout to continue activation.",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=complete-payment-retry",
    });

    await waitFor(() => {
      expect(
        screen.getByText("Payment failed. Retry checkout to continue activation."),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Ready")).toBeNull();
    expect(screen.getByRole("link", { name: "Open demo dashboard" }).getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo?locale=en#token=complete-payment-retry",
    );
    const job = getPreviewStatusCenterJobsSnapshot().find(
      (entry) => entry.previewId === "prospect-complete-payment-failed",
    );
    expect(job).toMatchObject({
      status: "failed",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=complete-payment-retry",
      error: "Payment failed. Retry checkout to continue activation.",
    });
  });

  it("keeps the demo dashboard link when prospect showcase creation fails immediately", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-immediate-failed",
          statusToken: "status-token",
          status: "failed",
          error: "Payment failed. Retry checkout to continue activation.",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=immediate-retry",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(
        screen.getByText("Payment failed. Retry checkout to continue activation."),
      ).toBeTruthy();
    });
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Open demo dashboard" }).getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo?locale=en#token=immediate-retry",
    );
    const job = getPreviewStatusCenterJobsSnapshot().find(
      (entry) => entry.previewId === "prospect-immediate-failed",
    );
    expect(job?.demoDashboardUrl).toBe("https://weblingo.app/dashboard/demo#token=immediate-retry");
  });

  it("does not mark prospect showcase checkout guidance as ready", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-immediate-checkout",
          statusToken: "status-token",
          status: "checkout_pending",
          message: "Complete payment to publish this demo on your domain.",
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=immediate-checkout",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    const job = getPreviewStatusCenterJobsSnapshot().find(
      (entry) => entry.previewId === "prospect-immediate-checkout",
    );
    expect(job).toMatchObject({
      status: "pending",
      demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=immediate-checkout",
    });
  });

  it("persists expiry timestamps from SSE status updates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "prospect-expiring-status",
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("status", {
      status: "processing",
      stage: "translating",
      expiresAt: "2026-06-02T10:00:00.000Z",
    });

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "prospect-expiring-status",
      );
      expect(job?.expiresAt).toBe(Date.parse("2026-06-02T10:00:00.000Z"));
    });
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
        disabled={false}
        fieldLayout="funnel"
      />,
    );

    // The restored terminal job renders the success card; the email survives the
    // translate-another reset because it is collected once.
    await waitFor(() => {
      expect(screen.getByText("We also emailed these links to owner@example.com.")).toBeTruthy();
      expect(getPreviewStatusCenterJobsSnapshot()[0]?.requestKey).toBe(requestKey);
    });

    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("owner@example.com")).toBeTruthy();
      expect((screen.getByPlaceholderText("https://example.com") as HTMLInputElement).value).toBe(
        "",
      );
    });
  });

  it("keeps the email editable after resetting from a restored prospect showcase job", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        prospectShowcaseRef: "prospect-next-3333",
        statusToken: "next-token",
        status: "pending",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const requestKey = buildPreviewStatusCenterRequestKey({
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
          previewId: "prospect-legacy-2222-2222-2222-222222222222",
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
        disabled={false}
      />,
    );

    const translateAnother = await screen.findByRole("button", {
      name: "Translate another page",
    });
    fireEvent.click(translateAnother);

    const emailInput = await screen.findByDisplayValue("owner@example.com");
    fireEvent.change(emailInput, { target: { value: "next@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://restore.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(requestInit.body))).toMatchObject({
        sourceUrl: "https://restore.example.com",
        sourceLang: "en",
        targetLang: "fr",
        email: "next@example.com",
      });
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
        "/api/prospect-showcases/waiting-7777-7777-7777-777777777777/status?token=waiting-token",
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
      },
    });

    renderTryForm();

    await waitFor(() => {
      const job = getPreviewStatusCenterJobsSnapshot().find(
        (entry) => entry.previewId === "waiting-transient-7777-7777-7777-777777777777",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/waiting-transient-7777-7777-7777-777777777777/status?token=waiting-token",
      );
      expect(job?.status).toBe("waiting_provider_capacity");
      expect(job?.retryHint).toEqual({
        reason: "provider_capacity_wait",
        retryAfterSeconds: 30,
      });
      expect(job?.remoteStatusVerified).toBe(false);
      expect(screen.getByText("Waiting for translation capacity...")).toBeTruthy();
      expect(screen.getByText("Processing hint")).toBeTruthy();
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
        disabled={false}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com/docs" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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

  it("does not show the pending-email action for prospect showcase jobs", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: "processing" }));
    vi.stubGlobal("fetch", fetchMock);

    upsertPreviewStatusCenterJob({
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
        disabled={false}
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
      },
    });

    render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Capacity hint")).toBeTruthy();
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
      },
    });

    render(
      <TryForm
        locale="en"
        messages={messages}
        supportedLanguages={supportedLanguages}
        disabled={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Provider capacity hint")).toBeTruthy();
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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

  it("polls with the rotated store token instead of the captured one when SSE errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "rotate-5555-5555-5555-555555555555",
          statusToken: "original-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/rotate-5555-5555-5555-555555555555/status?token=fresh-token"
      ) {
        return jsonResponse({ status: "processing", stage: "translating" });
      }
      // The original token was revoked by the rotation: answering 401 here
      // would be misread as a terminal failure if the stale token leaked.
      return jsonResponse({ error: "Unauthorized" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    // Another tab reattached the same submission; cross-tab sync delivered the
    // rotated token while this tab's EventSource was still open.
    updatePreviewStatusCenterJob("rotate-5555-5555-5555-555555555555", {
      statusToken: "fresh-token",
    });

    MockEventSource.instances[0].emit("error");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/rotate-5555-5555-5555-555555555555/status?token=fresh-token",
      );
    });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toContain(
      "/api/prospect-showcases/rotate-5555-5555-5555-555555555555/status?token=original-token",
    );
    expect(screen.queryByText("Preview failed.")).toBeNull();
  });

  it("rehydrates a persisted rotated token before SSE fallback polls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "persisted-rotate-5555-5555-5555-555555555555",
          statusToken: "original-token",
          status: "pending",
        });
      }
      if (
        url ===
        "/api/prospect-showcases/persisted-rotate-5555-5555-5555-555555555555/status?token=persisted-fresh-token"
      ) {
        return jsonResponse({ status: "processing", stage: "translating" });
      }
      return jsonResponse({ error: "Unauthorized" }, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const [job] = getPreviewStatusCenterJobsSnapshot();
    expect(job).toBeTruthy();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          ...job,
          statusToken: "persisted-fresh-token",
          statusTokenUpdatedAt: Date.now() + 1_000,
        },
      ]),
    );

    MockEventSource.instances[0].emit("error");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/persisted-rotate-5555-5555-5555-555555555555/status?token=persisted-fresh-token",
      );
    });
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toContain(
      "/api/prospect-showcases/persisted-rotate-5555-5555-5555-555555555555/status?token=original-token",
    );
  });

  it("keeps the stepper and falls back to polling when the SSE stream errors", async () => {
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("error");

    // SSE loss is a transport event: no alarm copy, the stepper stays, and the
    // form silently checks status over HTTP.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases/timeout-active-8888-8888-8888-888888888888/status?token=timeout-token",
      );
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
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
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

  it("keeps the demo-dashboard handoff visible for restored expired jobs", async () => {
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://expired-dashboard.example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    });
    const now = Date.now();
    window.localStorage.setItem(
      PREVIEW_STATUS_CENTER_STORAGE_KEY,
      JSON.stringify([
        {
          previewId: "88888888-8888-8888-8888-888888888888",
          requestKey,
          statusToken: "expired-token",
          sourceUrl: "https://expired-dashboard.example.com",
          sourceLang: "en",
          targetLang: "fr",
          status: "expired",
          stage: null,
          previewUrl: null,
          demoDashboardUrl: "https://weblingo.app/dashboard/demo#token=expired-handoff",
          error: "Preview expired",
          errorCode: "preview_expired",
          errorStage: null,
          createdAt: now - 2_000,
          updatedAt: now - 1_000,
          expiresAt: now - 1_000,
          retryCount: 0,
          nextPollAt: Number.POSITIVE_INFINITY,
        },
      ]),
    );

    renderTryForm();

    await waitFor(() => {
      expect(screen.getByText("Preview expired")).toBeTruthy();
    });
    // The showcase serving is gone, but the retained dashboard token still works.
    expect(screen.getByRole("link", { name: "Open demo dashboard" }).getAttribute("href")).toBe(
      "https://weblingo.app/dashboard/demo?locale=en#token=expired-handoff",
    );
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
      expect(screen.getByText("Preview expired")).toBeTruthy();
      expect(
        screen.getByText(
          "If you contact support, include reference 66666666-6666-6666-6666-666666666666.",
        ),
      ).toBeTruthy();
    });

    // The restored legacy job has no email, so retry stays disabled until the
    // visitor re-enters the request through translate-another.
    const retryButton = screen.getByRole("button", { name: "Retry preview" }) as HTMLButtonElement;
    expect(retryButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Translate another page" }));
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://expired.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("reconnects an identical in-flight run through the create endpoint with the rotated token", async () => {
    const now = Date.now();
    const requestKey = buildPreviewStatusCenterRequestKey({
      sourceUrl: "https://inflight.example.com",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    });
    // Old enough to skip the auto-restore path, but still within the active budget.
    storeRestoredActiveJob({
      previewId: "inflight-8888-8888-8888-888888888888",
      requestKey,
      statusToken: "inflight-token",
      sourceUrl: "https://inflight.example.com",
      createdAt: now - 16 * 60 * 1000,
      updatedAt: now - 16 * 60 * 1000,
    });
    // The create endpoint dedupes server-side: the same ref comes back with a
    // freshly rotated status token (the stored one may have been rotated by
    // another tab and gone stale).
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "inflight-8888-8888-8888-888888888888",
          statusToken: "rotated-token",
          status: "processing",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://inflight.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases",
        expect.objectContaining({ method: "POST" }),
      );
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.instances[0].url).toBe(
        "/api/prospect-showcases/inflight-8888-8888-8888-888888888888/stream?token=rotated-token",
      );
    });

    MockEventSource.instances[0].emit("progress", {
      status: "processing",
      stage: "translating",
    });

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Preview progress" })).toBeTruthy();
    });
    const matching = getPreviewStatusCenterJobsSnapshot().filter(
      (job) => job.requestKey === requestKey,
    );
    expect(matching).toHaveLength(1);
    expect(matching[0]?.statusToken).toBe("rotated-token");
  });

  it("updates the tracked job when the backend dedupes the create request", async () => {
    const now = Date.now();
    // Legacy job without email in its request key: the client cannot reattach
    // locally, but the backend returns the same ref for the duplicate run.
    storeRestoredActiveJob({
      previewId: "dedupe-9999-9999-9999-999999999999",
      requestKey: buildPreviewStatusCenterRequestKey({
        sourceUrl: "https://dedupe.example.com",
        sourceLang: "en",
        targetLang: "fr",
      }),
      statusToken: "stale-token",
      sourceUrl: "https://dedupe.example.com",
      createdAt: now - 16 * 60 * 1000,
      updatedAt: now - 16 * 60 * 1000,
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/prospect-showcases") {
        return jsonResponse({
          prospectShowcaseRef: "dedupe-9999-9999-9999-999999999999",
          statusToken: "fresh-token",
          status: "processing",
        });
      }
      return jsonResponse({ status: "processing" });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTryForm();
    fireEvent.change(screen.getByPlaceholderText("https://example.com"), {
      target: { value: "https://dedupe.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate a private preview" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/prospect-showcases",
        expect.objectContaining({ method: "POST" }),
      );
      const jobs = getPreviewStatusCenterJobsSnapshot();
      const matching = jobs.filter((job) => job.previewId === "dedupe-9999-9999-9999-999999999999");
      expect(jobs).toHaveLength(1);
      expect(matching).toHaveLength(1);
      expect(matching[0]?.statusToken).toBe("fresh-token");
    });
  });
});
