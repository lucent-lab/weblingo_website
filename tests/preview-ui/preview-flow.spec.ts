import { expect, test, type Page, type Request } from "@playwright/test";

const PREVIEW_ID = "preview-ui-1111-1111-1111-111111111111";
const STATUS_TOKEN = "preview-ui-status-token";
const PREVIEW_URL = "https://preview.weblingo.app/_preview/preview-ui-ready";

type PreviewRequestPayload = {
  sourceUrl?: string;
  sourceLang?: string;
  targetLang?: string;
  locale?: string;
};

type BrowserEventSource = {
  dispatchPreviewEvent: (type: string, payload?: Record<string, unknown>) => void;
  closed: boolean;
  url: string;
};

async function installMockEventSource(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Listener = (event: Event | MessageEvent) => void;

    class MockEventSource {
      static readonly instances: MockEventSource[] = [];
      readonly url: string;
      closed = false;
      private readonly listeners = new Map<string, Listener[]>();

      constructor(url: string) {
        this.url = url;
        MockEventSource.instances.push(this);
        window.__weblingoPreviewEventSources = MockEventSource.instances;
      }

      addEventListener(type: string, listener: Listener): void {
        const bucket = this.listeners.get(type) ?? [];
        bucket.push(listener);
        this.listeners.set(type, bucket);
      }

      removeEventListener(type: string, listener: Listener): void {
        const bucket = this.listeners.get(type) ?? [];
        this.listeners.set(
          type,
          bucket.filter((candidate) => candidate !== listener),
        );
      }

      close(): void {
        this.closed = true;
      }

      dispatchPreviewEvent(type: string, payload?: Record<string, unknown>): void {
        const listeners = this.listeners.get(type) ?? [];
        const event =
          payload === undefined
            ? new Event(type)
            : new MessageEvent(type, { data: JSON.stringify(payload) });
        for (const listener of listeners) {
          listener(event);
        }
      }
    }

    window.__weblingoPreviewEventSources = MockEventSource.instances;
    window.EventSource = MockEventSource as unknown as typeof EventSource;
  });
}

async function dispatchPreviewEvent(
  page: Page,
  type: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(
    ({ eventType, eventPayload }) => {
      const sources = window.__weblingoPreviewEventSources ?? [];
      const source = sources[0];
      if (!source) {
        throw new Error("Expected a preview EventSource instance.");
      }
      source.dispatchPreviewEvent(eventType, eventPayload);
    },
    { eventType: type, eventPayload: payload },
  );
}

function previewApiRequestPath(request: Request): string {
  const url = new URL(request.url());
  return `${request.method()} ${url.pathname}`;
}

test("try form submits a mocked preview and exposes the ready handoff", async ({ page }) => {
  const apiRequests: string[] = [];
  const createPayloads: PreviewRequestPayload[] = [];

  await installMockEventSource(page);
  await page.route("**/api/previews", async (route) => {
    apiRequests.push(previewApiRequestPath(route.request()));
    createPayloads.push((route.request().postDataJSON() ?? {}) as PreviewRequestPayload);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        previewId: PREVIEW_ID,
        statusToken: STATUS_TOKEN,
        status: "pending",
        stage: "fetching_page",
        previewUrl: null,
        expiresAt: "2026-05-14T00:00:00.000Z",
      }),
    });
  });

  await page.goto("/en");

  await page.getByPlaceholder("https://example.jp").fill("https://example.com");
  await page.getByRole("button", { name: "Generate preview" }).click();

  await expect(page.getByText("example.com", { exact: true })).toBeVisible();
  await expect(page.getByText("Fetching page").first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__weblingoPreviewEventSources?.[0]?.url ?? null))
    .toBe(`/api/previews/${PREVIEW_ID}/stream?token=${encodeURIComponent(STATUS_TOKEN)}`);

  await dispatchPreviewEvent(page, "progress", {
    status: "processing",
    stage: "translating",
  });
  await expect(page.getByText("Translating").first()).toBeVisible();

  await dispatchPreviewEvent(page, "complete", {
    status: "ready",
    previewUrl: PREVIEW_URL,
  });
  await expect(page.getByText("Ready").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open overlay preview" })).toHaveAttribute(
    "href",
    PREVIEW_URL,
  );
  await expect(page.locator("input[readonly]").last()).toHaveValue(PREVIEW_URL);

  expect(apiRequests).toEqual(["POST /api/previews"]);
  expect(createPayloads).toEqual([
    {
      sourceUrl: "https://example.com",
      sourceLang: "en",
      targetLang: "fr",
      locale: "en",
    },
  ]);
  expect(
    await page.evaluate(() => window.__weblingoPreviewEventSources?.[0]?.closed ?? false),
  ).toBe(true);
});

declare global {
  interface Window {
    __weblingoPreviewEventSources?: BrowserEventSource[];
  }
}
