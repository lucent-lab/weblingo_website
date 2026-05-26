import { expect, test, type Page, type Route } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const FIXTURE_BASE_ORIGIN = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${playwrightPort}`,
).origin;

const PASSIVE_EXTERNAL_MATCHERS = [
  "https://fonts.googleapis.com/",
  "https://cdn.prod.website-files.com/65a700000000000000000001/preview-qa-passive.js",
  "https://cdn.prod.website-files.com/65a700000000000000000001/preview-qa-logo.svg",
] as const;

const DOMAIN_BOUND_EXTERNAL_MATCHERS = [
  "https://www.google.com/recaptcha/",
  "https://challenges.cloudflare.com/",
  "https://js.hcaptcha.com/",
  "https://accounts.google.com/gsi/client",
  "https://js.stripe.com/",
  "https://www.paypal.com/",
  "https://js.hsforms.net/",
  "https://form.typeform.com/",
  "https://calendly.com/",
] as const;

function isPassiveExternal(url: string): boolean {
  return PASSIVE_EXTERNAL_MATCHERS.some((prefix) => url.startsWith(prefix));
}

function isDomainBoundExternal(url: string): boolean {
  return DOMAIN_BOUND_EXTERNAL_MATCHERS.some((prefix) => url.startsWith(prefix));
}

async function mockExternalFixtureRequests(page: Page): Promise<Set<string>> {
  const externalRequests = new Set<string>();

  await page.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === FIXTURE_BASE_ORIGIN || url.protocol === "data:") {
      await route.continue();
      return;
    }

    externalRequests.add(url.toString());

    if (request.resourceType() === "stylesheet") {
      await route.fulfill({
        body: "body { --preview-qa-passive-font-loaded: 1; }",
        contentType: "text/css; charset=utf-8",
        status: 200,
      });
      return;
    }

    if (request.resourceType() === "image") {
      await route.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 92 48"><rect width="92" height="48" fill="#476F55"/></svg>',
        contentType: "image/svg+xml; charset=utf-8",
        status: 200,
      });
      return;
    }

    if (request.resourceType() === "script") {
      await route.fulfill({
        body: "window.__WEBLINGO_PREVIEW_QA_MOCKED_EXTERNAL__ = (window.__WEBLINGO_PREVIEW_QA_MOCKED_EXTERNAL__ || 0) + 1;",
        contentType: "application/javascript; charset=utf-8",
        status: isPassiveExternal(url.toString()) ? 200 : 403,
      });
      return;
    }

    if (request.resourceType() === "document") {
      await route.fulfill({
        body: "<!doctype html><title>Mocked external fixture frame</title>",
        contentType: "text/html; charset=utf-8",
        status: 403,
      });
      return;
    }

    await route.fulfill({
      body: "mocked external fixture resource",
      contentType: "text/plain; charset=utf-8",
      status: 403,
    });
  });

  return externalRequests;
}

test("preview QA structural fixture preserves browser-observable subtree order", async ({
  page,
}) => {
  const response = await page.goto("/fixtures/preview-qa/structural-placeholders");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-weblingo-preview-qa-scenario"]).toBe("structural-placeholders");

  await expect(page.getByTestId("svg-only-logo-wrapper").locator("svg path")).toHaveCount(2);

  const placeholderOnlyOrder = await page
    .getByTestId("placeholder-only-ancestor")
    .evaluate((node) =>
      Array.from(node.children).map((child) => child.getAttribute("data-testid")),
    );
  expect(placeholderOnlyOrder).toEqual([
    "placeholder-only-first-descendant",
    "placeholder-only-second-descendant",
    "placeholder-only-template",
  ]);
  await expect(page.getByTestId("placeholder-only-ancestor")).toHaveText("");

  const textChainOrder = await page
    .getByTestId("ancestor-descendant-text-chain")
    .evaluate((node) =>
      Array.from(node.children).map((child) => child.getAttribute("data-testid")),
    );
  expect(textChainOrder).toEqual(["chain-icon", "chain-label"]);
  await expect(page.getByTestId("chain-icon").locator("svg path")).toHaveCount(1);
  await expect(page.getByTestId("chain-label")).toHaveText("Open archive");

  const signButtonDirectText = await page.getByTestId("guestbook-sign-button").evaluate((node) =>
    Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent?.trim() ?? "")
      .filter(Boolean),
  );
  expect(signButtonDirectText).toEqual([]);
  await expect(page.getByTestId("guestbook-sign-visible")).toHaveText("Sign");
  await expect(page.getByTestId("guestbook-sign-sr-label")).toHaveText("Sign guestbook");
});

test("preview QA inline composite fixture exposes boundary spacing after hydration", async ({
  page,
}) => {
  const response = await page.goto("/fixtures/preview-qa/inline-composite-boundaries");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-weblingo-preview-qa-scenario"]).toBe("inline-composite-boundaries");

  await expect(page.locator("html")).toHaveAttribute("data-inline-composite-hydrated", "1");

  const headingShape = await page.getByTestId("mission-critical-heading").evaluate((node) => ({
    firstTextNode:
      node.firstChild?.nodeType === Node.TEXT_NODE ? node.firstChild.textContent : null,
    childTestIds: Array.from(node.children).map((child) => child.getAttribute("data-testid")),
    spacerText: node.querySelector('[data-testid="inline-empty-spacer"]')?.textContent,
    hydration: (node as HTMLElement).dataset.fixtureHydration,
  }));

  expect(headingShape).toEqual({
    firstTextNode: "Systems Engineering for ",
    childTestIds: ["mission-critical-word", "inline-empty-spacer", "foundations-word"],
    spacerText: " ",
    hydration: "source-restored",
  });
  await expect(page.getByTestId("mission-critical-word")).toHaveText("Mission-Critical");
  await expect(page.getByTestId("foundations-word")).toHaveText("Foundations.");
});

test("preview QA source repair fixture repeats context-sensitive hydrated source text", async ({
  page,
}) => {
  const response = await page.goto("/fixtures/preview-qa/source-repair-context");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-weblingo-preview-qa-scenario"]).toBe("source-repair-context");

  await expect(page.locator("html")).toHaveAttribute("data-source-repair-hydrated", "1");
  await expect(page.getByTestId("source-repair-hero")).toHaveText("Automated accounting");
  await expect(page.getByTestId("source-repair-card-heading")).toHaveText("Automated accounting");
  await expect(page.getByTestId("source-repair-second-heading")).toHaveText("Automated accounting");
  await expect(page.getByTestId("source-repair-card-copy")).toHaveText("Accounting automation");
  await expect(page.getByTestId("source-repair-button")).toHaveText("Accounting automation");
});

test("preview QA domain-bound fixture separates capability candidates from passive controls", async ({
  page,
}) => {
  const externalRequests = await mockExternalFixtureRequests(page);

  const response = await page.goto("/fixtures/preview-qa/domain-bound-widgets");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-weblingo-preview-qa-scenario"]).toBe("domain-bound-widgets");

  await page.waitForLoadState("networkidle");

  await expect(page.locator("[data-weblingo-domain-bound-candidate]")).toHaveCount(10);
  await expect(page.locator("[data-weblingo-passive-external]")).toHaveCount(5);
  await expect(
    page.locator(
      "[data-weblingo-passive-external][data-weblingo-domain-bound-candidate], [data-weblingo-passive-external] [data-weblingo-domain-bound-candidate]",
    ),
  ).toHaveCount(0);

  const observedExternalUrls = Array.from(externalRequests);
  expect(
    PASSIVE_EXTERNAL_MATCHERS.every((prefix) =>
      observedExternalUrls.some((url) => url.startsWith(prefix)),
    ),
  ).toBe(true);
  expect(
    DOMAIN_BOUND_EXTERNAL_MATCHERS.some((prefix) =>
      observedExternalUrls.some((url) => url.startsWith(prefix)),
    ),
  ).toBe(true);
  expect(
    observedExternalUrls.filter(isPassiveExternal).every((url) => !isDomainBoundExternal(url)),
  ).toBe(true);
});
