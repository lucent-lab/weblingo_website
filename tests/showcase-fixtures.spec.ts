import { expect, test, type Page, type Response } from "@playwright/test";

const FIXTURE_BASE_ORIGIN = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000")
  .origin;
const FIXTURE_PAGE_CACHE_CONTROL = "public, max-age=60";
const FIXTURE_STATIC_ASSET_CACHE_CONTROL = "public, max-age=0";
const STATIC_FIXTURE_ASSET_PATHS = new Set([
  "/fixtures/showcase/logo.svg",
  "/fixtures/showcase/showcase.css",
  "/fixtures/showcase/widget.js",
]);

type FixtureRequestIssue = {
  url: string;
  status?: number;
  resourceType?: string;
  failure?: string | null;
  reason: string;
};

type CollectFixtureRequestIssueOptions = {
  allowedExternalUrls?: ReadonlySet<string>;
};

function normalizeUrlForAssertion(value: string): string {
  const url = new URL(value, FIXTURE_BASE_ORIGIN);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  const sortedParams = Array.from(url.searchParams.entries()).sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );
  url.search = "";
  for (const [key, paramValue] of sortedParams) {
    url.searchParams.append(key, paramValue);
  }
  return url.toString();
}

function expectUrlEquivalent(actual: string, expected: string): void {
  expect(normalizeUrlForAssertion(actual)).toBe(normalizeUrlForAssertion(expected));
}

async function expectPageUrlEquivalent(page: Page, expectedUrl: string): Promise<void> {
  await expect
    .poll(() => normalizeUrlForAssertion(page.url()))
    .toBe(normalizeUrlForAssertion(expectedUrl));
}

function classifyFixtureRequest(
  value: string,
  status?: number,
  options: CollectFixtureRequestIssueOptions = {},
): string | null {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (options.allowedExternalUrls?.has(url.toString())) {
    return null;
  }
  if (url.pathname === "/favicon.ico") {
    return null;
  }
  if (url.origin !== FIXTURE_BASE_ORIGIN) {
    return `unexpected origin ${url.origin}`;
  }
  if (url.pathname !== "/fixtures/showcase" && !url.pathname.startsWith("/fixtures/showcase/")) {
    return `unexpected path ${url.pathname}`;
  }
  if (status !== undefined && status >= 400) {
    return `HTTP ${status}`;
  }
  return null;
}

function expectedFixtureCacheControl(response: Response): string | null {
  if (response.status() < 200 || response.status() >= 300) {
    return null;
  }
  const url = new URL(response.url());
  if (url.origin !== FIXTURE_BASE_ORIGIN) {
    return null;
  }
  if (STATIC_FIXTURE_ASSET_PATHS.has(url.pathname)) {
    return FIXTURE_STATIC_ASSET_CACHE_CONTROL;
  }
  if (
    response.request().method() === "GET" &&
    response.request().resourceType() === "document" &&
    (url.pathname === "/fixtures/showcase" || url.pathname.startsWith("/fixtures/showcase/"))
  ) {
    return FIXTURE_PAGE_CACHE_CONTROL;
  }
  return null;
}

function collectFixtureRequestIssues(
  page: Page,
  options: CollectFixtureRequestIssueOptions = {},
): FixtureRequestIssue[] {
  const issues: FixtureRequestIssue[] = [];

  page.on("response", (response) => {
    const url = response.url();
    const reason = classifyFixtureRequest(url, response.status(), options);
    if (reason) {
      issues.push({ url, status: response.status(), reason });
      return;
    }
    const expectedCacheControl = expectedFixtureCacheControl(response);
    const actualCacheControl = response.headers()["cache-control"] ?? null;
    if (expectedCacheControl && actualCacheControl !== expectedCacheControl) {
      issues.push({
        url,
        status: response.status(),
        reason: `cache-control ${actualCacheControl ?? "<missing>"} !== ${expectedCacheControl}`,
      });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const parsed = new URL(url);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.pathname === "/favicon.ico"
    ) {
      return;
    }
    const reason = classifyFixtureRequest(url, undefined, options) ?? "request failed";
    issues.push({
      url,
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText ?? null,
      reason,
    });
  });

  return issues;
}

async function clickAndExpect(
  page: Page,
  selector: string,
  expectedUrl: string,
  heading: string,
): Promise<void> {
  await page.locator(selector).click();
  await expectPageUrlEquivalent(page, expectedUrl);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function gotoFixture(page: Page, path: string): Promise<Response> {
  const response = await page.goto(path);
  expect(response, `${path} should return a document response`).not.toBeNull();
  expect(response!.status(), `${path} document status`).toBeGreaterThanOrEqual(200);
  expect(response!.status(), `${path} document status`).toBeLessThan(400);
  expect(response!.headers()["cache-control"], `${path} cache-control`).toBe(
    FIXTURE_PAGE_CACHE_CONTROL,
  );
  return response!;
}

test("showcase marketing fixture exposes link, metadata, and asset sentinels", async ({ page }) => {
  const externalReferenceUrl = "https://developer.mozilla.org/en-US/";
  const fixtureIssues = collectFixtureRequestIssues(page, {
    allowedExternalUrls: new Set([externalReferenceUrl]),
  });
  const interceptedExternalRequests: string[] = [];
  await page.route("https://developer.mozilla.org/**", async (route) => {
    const request = route.request();
    interceptedExternalRequests.push(`${request.method()} ${request.url()}`);
    await route.fulfill({
      body: [
        "<!doctype html>",
        '<html lang="en">',
        "<head><title>Intercepted external reference</title>",
        '<link rel="icon" href="data:,">',
        "</head>",
        "<body><h1>Intercepted external reference</h1></body>",
        "</html>",
      ].join(""),
      contentType: "text/html; charset=utf-8",
      status: 200,
    });
  });

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await page.waitForLoadState("networkidle");
  expect(interceptedExternalRequests).toEqual([]);

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "marketing");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(
    page.getByRole("heading", { name: "Translate product pages without losing the buyer path" }),
  ).toBeVisible();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://weblingo.app/fixtures/showcase/marketing",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/showcase/marketing",
  );
  await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/showcase/marketing",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
    "href",
    "https://weblingo.app/fr/fixtures/showcase/marketing",
  );
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute(
    "href",
    "/fixtures/showcase/logo.svg?v=20260416",
  );
  await expect(page.locator('link[rel="modulepreload"]')).toHaveAttribute(
    "href",
    "/fixtures/showcase/widget.js?v=20260416&modulepreload=1",
  );

  const relativeSiblingHref = await page
    .locator('[data-check="relative-sibling"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    relativeSiblingHref,
    new URL("/fixtures/showcase/marketing/about?tab=story#team", page.url()).toString(),
  );

  const parentRelativeHref = await page
    .locator('[data-check="parent-relative"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    parentRelativeHref,
    new URL("/fixtures/showcase/docs/start?from=marketing#setup", page.url()).toString(),
  );

  const queryOnlyHref = await page
    .locator('[data-check="query-only"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    queryOnlyHref,
    new URL("/fixtures/showcase/marketing/?audience=buyers#overview", page.url()).toString(),
  );

  const sourceFallbackHref = await page
    .locator('[data-check="source-fallback-root"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    sourceFallbackHref,
    new URL("/fixtures/showcase/original-only?from=marketing#faq", page.url()).toString(),
  );

  const externalHref = await page
    .locator('[data-check="external"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  const externalUrl = new URL(externalHref);
  expect(externalUrl.origin).toBe("https://developer.mozilla.org");
  expect(externalUrl.toString()).toBe(externalReferenceUrl);
  expect(externalUrl.origin).not.toBe(FIXTURE_BASE_ORIGIN);
  expect(interceptedExternalRequests).toEqual([]);

  const responsiveImageCurrentSrc = await page
    .locator('[data-check="responsive-image"] img')
    .evaluate((image: HTMLImageElement) => image.currentSrc);
  expect(responsiveImageCurrentSrc).toContain("/fixtures/showcase/logo.svg");

  const cssBackgroundImage = await page
    .locator(".fixture-shell")
    .evaluate((element) => getComputedStyle(element, "::before").backgroundImage);
  expect(cssBackgroundImage).toContain("/fixtures/showcase/logo.svg");

  await clickAndExpect(
    page,
    '[data-check="root-internal"]',
    new URL("/fixtures/showcase/marketing/pricing?utm=nav#buy", page.url()).toString(),
    "Pricing that keeps translated links stable",
  );

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="relative-sibling"]',
    new URL("/fixtures/showcase/marketing/about?tab=story#team", page.url()).toString(),
    "About the localized showcase fixture",
  );

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="parent-relative"]',
    new URL("/fixtures/showcase/docs/start?from=marketing#setup", page.url()).toString(),
    "Set up translated docs without breaking references",
  );

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="source-fallback-root"]',
    new URL("/fixtures/showcase/original-only?from=marketing#faq", page.url()).toString(),
    "Source-only original page",
  );

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await page.locator('input[name="email"]').fill("not-an-email");
  await page.getByRole("button", { name: "Request localized preview" }).click();
  await expectPageUrlEquivalent(
    page,
    new URL("/fixtures/showcase/marketing", page.url()).toString(),
  );
  await expect
    .poll(() =>
      page
        .locator('input[name="email"]')
        .evaluate((input: HTMLInputElement) => input.validity.typeMismatch),
    )
    .toBe(true);

  await page.locator('input[name="email"]').fill("buyer@example.com");
  await page.locator('input[name="email"]').press("Enter");
  await expectPageUrlEquivalent(
    page,
    new URL(
      "/fixtures/showcase/marketing/contact/thanks?source=form#thanks",
      page.url(),
    ).toString(),
  );
  await expect(page.getByRole("heading", { name: "Preview request received" })).toBeVisible();

  expect(fixtureIssues).toEqual([]);

  await gotoFixture(page, "/fixtures/showcase/marketing");
  await page.waitForLoadState("networkidle");
  expect(fixtureIssues).toEqual([]);
  expect(interceptedExternalRequests).toEqual([]);
  await Promise.all([
    page.waitForURL(externalReferenceUrl),
    page.locator('[data-check="external"]').click(),
  ]);
  expect(interceptedExternalRequests).toEqual([`GET ${externalReferenceUrl}`]);
  await expect(page.getByRole("heading", { name: "Intercepted external reference" })).toBeVisible();
  expect(fixtureIssues).toEqual([]);
});

test("showcase app fixture runs non-eval interactivity", async ({ page }) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  await gotoFixture(page, "/fixtures/showcase/app/dashboard");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "app");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer closed");

  await page.locator("[data-fixture-toggle]").focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-fixture-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer open");

  await page.keyboard.press("Space");

  await expect(page.locator("[data-fixture-toggle]")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer closed");

  await page.locator("[data-fixture-toggle]").click();

  await expect(page.locator("[data-fixture-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer open");
  expect(fixtureIssues).toEqual([]);
});

test("showcase root-base fixture resolves base-relative assets and links", async ({ page }) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  await gotoFixture(page, "/fixtures/showcase/root-base");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "root-base");
  await expect(page.locator("base")).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("heading", { name: "Root base showcase links stay in namespace" }),
  ).toBeVisible();

  await expect(page.locator('[data-check="root-base-pricing"]')).toHaveAttribute(
    "href",
    "fixtures/showcase/marketing/pricing?from=root-base#buy",
  );
  await expect(page.locator('[data-check="root-base-relative-stylesheet"]')).toHaveAttribute(
    "href",
    "fixtures/showcase/showcase.css?v=20260416&root-base=1",
  );
  await expect(page.locator('[data-check="root-base-relative-script"]')).toHaveAttribute(
    "src",
    "fixtures/showcase/widget.js?v=20260416&root-base=1",
  );
  const pricingHref = await page
    .locator('[data-check="root-base-pricing"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    pricingHref,
    new URL("/fixtures/showcase/marketing/pricing?from=root-base#buy", page.url()).toString(),
  );

  const docsHref = await page
    .locator('[data-check="root-base-docs"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    docsHref,
    new URL("/fixtures/showcase/docs/start?from=root-base#authentication", page.url()).toString(),
  );

  const sourceFallbackHref = await page
    .locator('[data-check="root-base-source-fallback"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    sourceFallbackHref,
    new URL("/fixtures/showcase/original-only?from=root-base#faq", page.url()).toString(),
  );

  const relativeImageCurrentSrc = await page
    .locator('[data-check="root-base-relative-image"]')
    .evaluate((image: HTMLImageElement) => image.currentSrc);
  expectUrlEquivalent(
    relativeImageCurrentSrc,
    new URL("/fixtures/showcase/logo.svg?v=20260416&root-base=1", page.url()).toString(),
  );
  const relativeStylesheetHref = await page
    .locator('[data-check="root-base-relative-stylesheet"]')
    .evaluate((link: HTMLLinkElement) => link.href);
  expectUrlEquivalent(
    relativeStylesheetHref,
    new URL("/fixtures/showcase/showcase.css?v=20260416&root-base=1", page.url()).toString(),
  );
  const relativeScriptSrc = await page
    .locator('[data-check="root-base-relative-script"]')
    .evaluate((script: HTMLScriptElement) => script.src);
  expectUrlEquivalent(
    relativeScriptSrc,
    new URL("/fixtures/showcase/widget.js?v=20260416&root-base=1", page.url()).toString(),
  );

  await clickAndExpect(
    page,
    '[data-check="root-base-pricing"]',
    new URL("/fixtures/showcase/marketing/pricing?from=root-base#buy", page.url()).toString(),
    "Pricing that keeps translated links stable",
  );

  await gotoFixture(page, "/fixtures/showcase/root-base");
  await clickAndExpect(
    page,
    '[data-check="root-base-docs"]',
    new URL("/fixtures/showcase/docs/start?from=root-base#authentication", page.url()).toString(),
    "Set up translated docs without breaking references",
  );

  await gotoFixture(page, "/fixtures/showcase/root-base");
  await clickAndExpect(
    page,
    '[data-check="root-base-source-fallback"]',
    new URL("/fixtures/showcase/original-only?from=root-base#faq", page.url()).toString(),
    "Source-only original page",
  );

  expect(fixtureIssues).toEqual([]);
});

test("showcase multipart fixture submits browser multipart forms", async ({ page }) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  await gotoFixture(page, "/fixtures/showcase/marketing/multipart");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "marketing");
  await expect(page.getByRole("heading", { name: "Multipart lead form fixture" })).toBeVisible();
  await expect(page.locator('[data-check="multipart-lead-form"]')).toHaveAttribute(
    "enctype",
    "multipart/form-data",
  );

  await page.locator('input[name="email"]').fill("buyer@example.com");
  const multipartRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === "POST" &&
      url.origin === FIXTURE_BASE_ORIGIN &&
      url.pathname === "/fixtures/showcase/marketing/contact-multipart"
    );
  });
  await page.getByRole("button", { name: "Request multipart preview" }).click();
  const multipartRequest = await multipartRequestPromise;
  expect(multipartRequest.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
  await expectPageUrlEquivalent(
    page,
    new URL(
      "/fixtures/showcase/marketing/contact/thanks?source=multipart#thanks",
      page.url(),
    ).toString(),
  );
  await expect(page.getByRole("heading", { name: "Preview request received" })).toBeVisible();
  expect(fixtureIssues).toEqual([]);
});

test("showcase docs fixture resolves nested base and relative links in the browser", async ({
  page,
}) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  await gotoFixture(page, "/fixtures/showcase/docs/start");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "docs");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(
    page.getByRole("heading", { name: "Set up translated docs without breaking references" }),
  ).toBeVisible();

  const apiHref = await page
    .locator('[data-check="docs-api"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    apiHref,
    new URL("/fixtures/showcase/docs/api?topic=keys#authentication", page.url()).toString(),
  );

  const parentHref = await page
    .locator('[data-check="docs-marketing"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    parentHref,
    new URL("/fixtures/showcase/marketing?from=docs", page.url()).toString(),
  );

  const deepRelativeHref = await page
    .locator('[data-check="docs-deep-relative"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    deepRelativeHref,
    new URL("/fixtures/showcase/marketing/pricing?from=docs#buy", page.url()).toString(),
  );

  const sourceOnlyHref = await page
    .locator('[data-check="docs-source-fallback"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    sourceOnlyHref,
    new URL("/fixtures/showcase/docs/source-only?from=docs#legacy", page.url()).toString(),
  );

  const fragmentHref = await page
    .locator('[data-check="docs-fragment"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expectUrlEquivalent(
    fragmentHref,
    new URL("/fixtures/showcase/docs/#authentication", page.url()).toString(),
  );

  await clickAndExpect(
    page,
    '[data-check="docs-api"]',
    new URL("/fixtures/showcase/docs/api?topic=keys#authentication", page.url()).toString(),
    "API reference for localized docs",
  );

  await gotoFixture(page, "/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-deep-relative"]',
    new URL("/fixtures/showcase/marketing/pricing?from=docs#buy", page.url()).toString(),
    "Pricing that keeps translated links stable",
  );

  await gotoFixture(page, "/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-source-fallback"]',
    new URL("/fixtures/showcase/docs/source-only?from=docs#legacy", page.url()).toString(),
    "Legacy docs source-only page",
  );

  await gotoFixture(page, "/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-fragment"]',
    new URL("/fixtures/showcase/docs#authentication", page.url()).toString(),
    "Docs fixture root with anchor target",
  );

  expect(fixtureIssues).toEqual([]);
});
