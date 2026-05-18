import { expect, test, type Page, type Response } from "@playwright/test";

const FIXTURE_BASE_ORIGIN = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000")
  .origin;
const FIXTURE_PAGE_CACHE_CONTROL = "public, max-age=60";
const FIXTURE_STATIC_ASSET_CACHE_CONTROL = "public, max-age=0";
const STATIC_FIXTURE_ASSET_PATHS = new Set([
  "/fixtures/showcase/logo.svg",
  "/fixtures/showcase/showcase.css",
]);

type FixtureRequestIssue = {
  url: string;
  status?: number;
  resourceType?: string;
  failure?: string | null;
  reason: string;
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

async function expectPageUrlEquivalent(page: Page, expectedUrl: string): Promise<void> {
  await expect
    .poll(() => normalizeUrlForAssertion(page.url()))
    .toBe(normalizeUrlForAssertion(expectedUrl));
}

function classifyFixtureRequest(value: string, status?: number): string | null {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.pathname === "/favicon.ico") {
    return null;
  }
  if (url.origin !== FIXTURE_BASE_ORIGIN) {
    return `unexpected origin ${url.origin}`;
  }
  const isFixturePage =
    url.pathname === "/fixtures/customer-seo" || url.pathname.startsWith("/fixtures/customer-seo/");
  if (!isFixturePage && !STATIC_FIXTURE_ASSET_PATHS.has(url.pathname)) {
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
    (url.pathname === "/fixtures/customer-seo" ||
      url.pathname.startsWith("/fixtures/customer-seo/"))
  ) {
    return FIXTURE_PAGE_CACHE_CONTROL;
  }
  return null;
}

function collectFixtureRequestIssues(page: Page): FixtureRequestIssue[] {
  const issues: FixtureRequestIssue[] = [];

  page.on("response", (response) => {
    const url = response.url();
    const reason = classifyFixtureRequest(url, response.status());
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
    const failure = request.failure()?.errorText ?? null;
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.pathname === "/favicon.ico"
    ) {
      return;
    }
    if (failure === "net::ERR_ABORTED" && STATIC_FIXTURE_ASSET_PATHS.has(parsed.pathname)) {
      return;
    }
    const reason = classifyFixtureRequest(url) ?? "request failed";
    issues.push({
      url,
      resourceType: request.resourceType(),
      failure,
      reason,
    });
  });

  return issues;
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

test("customer SEO product fixture exposes crawler-visible metadata and links", async ({
  page,
}) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  const response = await gotoFixture(page, "/fixtures/customer-seo/product");
  await page.waitForLoadState("networkidle");

  expect(response.headers()["x-weblingo-customer-seo-fixture"]).toBe("1");
  expect(response.headers()["x-weblingo-customer-seo-page"]).toBe("product");
  expect(response.headers()["x-weblingo-customer-seo-classification"]).toBe("customer");
  expect(response.headers()["x-robots-tag"]).toBeUndefined();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute(
    "data-weblingo-customer-seo-fixture",
    "customer",
  );
  await expect(page.getByRole("heading", { name: "Customer SEO product page" })).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A customer page fixture with canonical, social URLs, and image metadata.",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://weblingo.app/fixtures/customer-seo/product",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    "https://weblingo.app/fixtures/customer-seo/product",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/customer-seo/product",
  );
  await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/customer-seo/product",
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/showcase/logo.svg?v=20260416&customer-seo=product",
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    "https://weblingo.app/fixtures/showcase/logo.svg?v=20260416&customer-seo=product",
  );

  await page.locator('[data-check="customer-internal-link"]').click();
  await expectPageUrlEquivalent(
    page,
    `${FIXTURE_BASE_ORIGIN}/fixtures/customer-seo/product/pricing?plan=pro#plans`,
  );
  await expect(page.getByRole("heading", { name: "Customer SEO pricing page" })).toBeVisible();

  expect(fixtureIssues).toEqual([]);
});

test("customer SEO docs fixture preserves source-only missing-image fallback", async ({ page }) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  const response = await gotoFixture(page, "/fixtures/customer-seo/docs");
  await page.waitForLoadState("networkidle");

  expect(response.headers()["x-weblingo-customer-seo-page"]).toBe("docs");
  expect(response.headers()["x-weblingo-customer-seo-classification"]).toBe("customer");
  expect(response.headers()["x-robots-tag"]).toBeUndefined();

  await expect(page.getByRole("heading", { name: "Customer SEO docs page" })).toBeVisible();
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(0);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(0);
  await expect(page.locator('[data-check="docs-product-link"]')).toHaveAttribute(
    "href",
    "/fixtures/customer-seo/product#top",
  );

  expect(fixtureIssues).toEqual([]);
});

test("customer SEO internal fixture is explicitly noindex and internally classified", async ({
  page,
}) => {
  const fixtureIssues = collectFixtureRequestIssues(page);

  const response = await gotoFixture(page, "/fixtures/customer-seo/internal/qa-only");
  await page.waitForLoadState("networkidle");

  expect(response.headers()["x-weblingo-customer-seo-page"]).toBe("internal-qa-only");
  expect(response.headers()["x-weblingo-customer-seo-classification"]).toBe("internal");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await expect(page.locator("html")).toHaveAttribute(
    "data-weblingo-customer-seo-fixture",
    "internal",
  );
  await expect(page.getByRole("heading", { name: "Internal customer SEO QA page" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(0);

  expect(fixtureIssues).toEqual([]);
});
