import { expect, test, type Page } from "@playwright/test";

const MAX_LIVE_CASES = 10;
const DEFAULT_SAMPLE_MS = 4_000;
const DEFAULT_SAMPLE_INTERVAL_MS = 100;
const DEFAULT_ROTATOR_SAMPLE_MS = 6_000;
const DEFAULT_ROTATOR_INTERVAL_MS = 250;

type LivePreviewCase = {
  name: string;
  url: string;
  requiredText?: string[];
  forbiddenText?: string[];
  dom?: DomAssertion[];
  rotator?: {
    selector: string;
    minDistinctStates?: number;
    sampleMs?: number;
    intervalMs?: number;
    forbiddenText?: string[];
  };
};

type DomAssertion = {
  selector: string;
  textIncludes?: string[];
  textExcludes?: string[];
  firstChildTextEquals?: string;
  firstChildTextEndsWith?: string;
  childTestIds?: string[];
};

type SourceTextHit = {
  elapsedMs: number;
  hits: string[];
};

type PreviewUxProbe = {
  sourceTextHits: SourceTextHit[];
  startedAt: number;
  stop: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  return value;
}

function parsePositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function parseString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
  return value;
}

function parseDomAssertions(value: unknown, fieldName: string): DomAssertion[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value.map((entry, index) => {
    const entryField = `${fieldName}[${index}]`;
    if (!isRecord(entry)) {
      throw new Error(`${entryField} must be an object.`);
    }
    if (typeof entry.selector !== "string" || !entry.selector.trim()) {
      throw new Error(`${entryField}.selector must be a non-empty string.`);
    }
    return {
      selector: entry.selector,
      textIncludes: parseStringArray(entry.textIncludes, `${entryField}.textIncludes`),
      textExcludes: parseStringArray(entry.textExcludes, `${entryField}.textExcludes`),
      firstChildTextEquals: parseString(
        entry.firstChildTextEquals,
        `${entryField}.firstChildTextEquals`,
      ),
      firstChildTextEndsWith: parseString(
        entry.firstChildTextEndsWith,
        `${entryField}.firstChildTextEndsWith`,
      ),
      childTestIds: parseStringArray(entry.childTestIds, `${entryField}.childTestIds`),
    };
  });
}

function parseLivePreviewCases(): LivePreviewCase[] {
  const raw = process.env.PREVIEW_UX_CASES_JSON;
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("PREVIEW_UX_CASES_JSON must be a JSON array.");
  }
  if (parsed.length > MAX_LIVE_CASES) {
    throw new Error(`PREVIEW_UX_CASES_JSON is capped at ${MAX_LIVE_CASES} cases.`);
  }

  return parsed.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Preview UX case ${index} must be an object.`);
    }
    if (typeof entry.name !== "string" || !entry.name.trim()) {
      throw new Error(`Preview UX case ${index} requires a name.`);
    }
    if (typeof entry.url !== "string" || !entry.url.trim()) {
      throw new Error(`Preview UX case ${entry.name} requires a url.`);
    }
    new URL(entry.url);

    let rotator: LivePreviewCase["rotator"];
    if (entry.rotator !== undefined) {
      if (!isRecord(entry.rotator)) {
        throw new Error(`Preview UX case ${entry.name} rotator must be an object.`);
      }
      if (typeof entry.rotator.selector !== "string" || !entry.rotator.selector.trim()) {
        throw new Error(`Preview UX case ${entry.name} rotator requires a selector.`);
      }
      rotator = {
        selector: entry.rotator.selector,
        minDistinctStates: parsePositiveInteger(
          entry.rotator.minDistinctStates,
          `${entry.name}.rotator.minDistinctStates`,
        ),
        sampleMs: parsePositiveInteger(entry.rotator.sampleMs, `${entry.name}.rotator.sampleMs`),
        intervalMs: parsePositiveInteger(
          entry.rotator.intervalMs,
          `${entry.name}.rotator.intervalMs`,
        ),
        forbiddenText: parseStringArray(
          entry.rotator.forbiddenText,
          `${entry.name}.rotator.forbiddenText`,
        ),
      };
    }

    return {
      name: entry.name,
      url: entry.url,
      requiredText: parseStringArray(entry.requiredText, `${entry.name}.requiredText`),
      forbiddenText: parseStringArray(entry.forbiddenText, `${entry.name}.forbiddenText`),
      dom: parseDomAssertions(entry.dom, `${entry.name}.dom`),
      rotator,
    };
  });
}

async function installSourceTextProbe(
  page: Page,
  forbiddenText: string[],
  sampleMs: number,
  sampleIntervalMs: number,
): Promise<void> {
  await page.addInitScript(
    ({ phrases, durationMs, intervalMs }) => {
      const startedAt = performance.now();
      let timer = 0;
      const probe: PreviewUxProbe = {
        sourceTextHits: [],
        startedAt,
        stop: () => clearInterval(timer),
      };

      const visibleText = () => document.body?.innerText ?? "";
      const record = () => {
        const text = visibleText();
        const hits = phrases.filter((phrase) => phrase && text.includes(phrase));
        if (hits.length > 0) {
          probe.sourceTextHits.push({
            elapsedMs: Math.round(performance.now() - startedAt),
            hits,
          });
        }
      };

      const observer = new MutationObserver(record);
      timer = window.setInterval(record, intervalMs);
      window.__weblingoPreviewUxProbe = probe;

      document.addEventListener("DOMContentLoaded", () => {
        if (document.documentElement) {
          observer.observe(document.documentElement, {
            childList: true,
            characterData: true,
            subtree: true,
          });
        }
        record();
      });

      window.setTimeout(() => {
        observer.disconnect();
        clearInterval(timer);
      }, durationMs);
    },
    { phrases: forbiddenText, durationMs: sampleMs, intervalMs: sampleIntervalMs },
  );
}

async function sampleRotatorStates(
  page: Page,
  selector: string,
  sampleMs: number,
  intervalMs: number,
): Promise<string[]> {
  return page.evaluate(
    async ({ rotatorSelector, durationMs, delayMs }) => {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const deadline = Date.now() + durationMs;
      const samples: string[] = [];

      while (Date.now() <= deadline) {
        const element = document.querySelector(rotatorSelector);
        if (element instanceof HTMLElement) {
          const text = normalize(element.innerText);
          if (text) {
            samples.push(text);
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }

      return Array.from(new Set(samples));
    },
    { rotatorSelector: selector, durationMs: sampleMs, delayMs: intervalMs },
  );
}

function includesAnyForbiddenText(value: string, forbiddenText: string[] | undefined): string[] {
  if (!forbiddenText?.length) {
    return [];
  }
  return forbiddenText.filter((phrase) => phrase && value.includes(phrase));
}

async function assertDomAssertions(page: Page, assertions: DomAssertion[] | undefined) {
  for (const assertion of assertions ?? []) {
    const locator = page.locator(assertion.selector);
    await expect(locator, `${assertion.selector} should resolve to one element`).toHaveCount(1);
    const snapshot = await locator.evaluate((node) => ({
      textContent: node.textContent ?? "",
      firstChildText:
        node.firstChild?.nodeType === Node.TEXT_NODE ? node.firstChild.textContent : null,
      childTestIds: Array.from(node.children).map((child) => child.getAttribute("data-testid")),
    }));

    for (const expected of assertion.textIncludes ?? []) {
      expect(snapshot.textContent, `${assertion.selector} should contain ${expected}`).toContain(
        expected,
      );
    }
    for (const forbidden of assertion.textExcludes ?? []) {
      expect(
        snapshot.textContent,
        `${assertion.selector} should not contain ${forbidden}`,
      ).not.toContain(forbidden);
    }
    if (assertion.firstChildTextEquals !== undefined) {
      expect(snapshot.firstChildText, `${assertion.selector} first text node`).toBe(
        assertion.firstChildTextEquals,
      );
    }
    if (assertion.firstChildTextEndsWith !== undefined) {
      expect(snapshot.firstChildText, `${assertion.selector} first text node`).not.toBeNull();
      expect(
        (snapshot.firstChildText ?? "").endsWith(assertion.firstChildTextEndsWith),
        `${assertion.selector} first text node should end with ${JSON.stringify(assertion.firstChildTextEndsWith)}`,
      ).toBe(true);
    }
    if (assertion.childTestIds) {
      expect(snapshot.childTestIds, `${assertion.selector} direct child test ids`).toEqual(
        assertion.childTestIds,
      );
    }
  }
}

const liveCases = parseLivePreviewCases();

if (liveCases.length === 0) {
  test("skips live translated preview UX probes without explicit cases", async () => {
    if (process.env.WEBLINGO_LIVE_PREVIEW_QA === "1") {
      throw new Error("WEBLINGO_LIVE_PREVIEW_QA=1 requires PREVIEW_UX_CASES_JSON.");
    }
    test.skip(
      process.env.WEBLINGO_LIVE_PREVIEW_QA !== "1" || !process.env.PREVIEW_UX_CASES_JSON,
      "Set WEBLINGO_LIVE_PREVIEW_QA=1 and PREVIEW_UX_CASES_JSON to run live preview UX probes.",
    );
  });
} else {
  test.describe("live translated preview UX probes", () => {
    test.skip(
      process.env.WEBLINGO_LIVE_PREVIEW_QA !== "1",
      "Live translated-preview probes are opt-in to avoid accidental quota usage.",
    );

    for (const previewCase of liveCases) {
      test(previewCase.name, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const routeDataFailures: string[] = [];
        const caseUrl = new URL(previewCase.url);
        const forbiddenText = previewCase.forbiddenText ?? [];
        const sampleMs = DEFAULT_SAMPLE_MS;

        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(message.text());
          }
        });
        page.on("pageerror", (error) => {
          pageErrors.push(error.message);
        });
        page.on("response", (response) => {
          const url = new URL(response.url());
          if (
            url.origin === caseUrl.origin &&
            url.searchParams.has("_rsc") &&
            response.status() >= 400
          ) {
            routeDataFailures.push(`${response.status()} ${response.url()}`);
          }
        });
        page.on("requestfailed", (request) => {
          const url = new URL(request.url());
          if (url.origin === caseUrl.origin && url.searchParams.has("_rsc")) {
            routeDataFailures.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
          }
        });

        await installSourceTextProbe(page, forbiddenText, sampleMs, DEFAULT_SAMPLE_INTERVAL_MS);
        const response = await page.goto(previewCase.url, { waitUntil: "domcontentloaded" });
        expect(response, `${previewCase.url} should return a document response`).not.toBeNull();
        expect(response!.status(), `${previewCase.url} document status`).toBeLessThan(400);

        await page.waitForTimeout(sampleMs);

        const bodyText = await page.locator("body").innerText();
        for (const requiredText of previewCase.requiredText ?? []) {
          expect(bodyText).toContain(requiredText);
        }

        const persistentForbiddenHits = includesAnyForbiddenText(bodyText, forbiddenText);
        expect(persistentForbiddenHits, "source-language text stayed visible").toEqual([]);

        await assertDomAssertions(page, previewCase.dom);

        const sourceTextHits = await page.evaluate(
          () => window.__weblingoPreviewUxProbe?.sourceTextHits ?? [],
        );
        expect(sourceTextHits, "source-language text flickered into the visible page").toEqual([]);

        if (previewCase.rotator) {
          const rotatorStates = await sampleRotatorStates(
            page,
            previewCase.rotator.selector,
            previewCase.rotator.sampleMs ?? DEFAULT_ROTATOR_SAMPLE_MS,
            previewCase.rotator.intervalMs ?? DEFAULT_ROTATOR_INTERVAL_MS,
          );
          expect(
            rotatorStates.length,
            `rotator states observed: ${rotatorStates.join(" | ")}`,
          ).toBeGreaterThanOrEqual(previewCase.rotator.minDistinctStates ?? 2);

          const forbiddenRotatorHits = rotatorStates.flatMap((state) =>
            includesAnyForbiddenText(state, previewCase.rotator?.forbiddenText),
          );
          expect(forbiddenRotatorHits, "source-language text stayed in rotator states").toEqual([]);
        }

        expect(routeDataFailures, "same-origin route-data requests should not fail").toEqual([]);
        expect(pageErrors, "page runtime errors").toEqual([]);
        expect(
          consoleErrors.filter((message) => !message.includes("favicon.ico")),
          "console errors",
        ).toEqual([]);
      });
    }
  });
}

declare global {
  interface Window {
    __weblingoPreviewUxProbe?: PreviewUxProbe;
  }
}
