import { expect, test, type Page } from "@playwright/test";

type FixtureFailure = {
  url: string;
  status?: number;
  resourceType?: string;
  failure?: string | null;
};

function collectFixtureFailures(page: Page): FixtureFailure[] {
  const failures: FixtureFailure[] = [];

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/fixtures/showcase/") && response.status() >= 400) {
      failures.push({ url, status: response.status() });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/fixtures/showcase/")) {
      failures.push({
        url,
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText ?? null,
      });
    }
  });

  return failures;
}

async function clickAndExpect(
  page: Page,
  selector: string,
  expectedUrl: string,
  heading: string,
): Promise<void> {
  await page.locator(selector).click();
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

test("showcase marketing fixture exposes link, metadata, and asset sentinels", async ({ page }) => {
  const fixtureFailures = collectFixtureFailures(page);

  await page.goto("/fixtures/showcase/marketing");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "marketing");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(
    page.getByRole("heading", { name: "Translate product pages without losing the buyer path" }),
  ).toBeVisible();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
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
  expect(relativeSiblingHref).toBe(
    new URL("/fixtures/showcase/marketing/about?tab=story#team", page.url()).toString(),
  );

  const parentRelativeHref = await page
    .locator('[data-check="parent-relative"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(parentRelativeHref).toBe(
    new URL("/fixtures/showcase/docs/start?from=marketing#setup", page.url()).toString(),
  );

  const queryOnlyHref = await page
    .locator('[data-check="query-only"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(queryOnlyHref).toBe(
    new URL("/fixtures/showcase/marketing/?audience=buyers#overview", page.url()).toString(),
  );

  const sourceFallbackHref = await page
    .locator('[data-check="source-fallback-root"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(sourceFallbackHref).toBe(
    new URL("/fixtures/showcase/original-only?from=marketing#faq", page.url()).toString(),
  );

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

  await page.goto("/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="relative-sibling"]',
    new URL("/fixtures/showcase/marketing/about?tab=story#team", page.url()).toString(),
    "About the localized showcase fixture",
  );

  await page.goto("/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="parent-relative"]',
    new URL("/fixtures/showcase/docs/start?from=marketing#setup", page.url()).toString(),
    "Set up translated docs without breaking references",
  );

  await page.goto("/fixtures/showcase/marketing");
  await clickAndExpect(
    page,
    '[data-check="source-fallback-root"]',
    new URL("/fixtures/showcase/original-only?from=marketing#faq", page.url()).toString(),
    "Source-only original page",
  );

  await page.goto("/fixtures/showcase/marketing");
  await page.locator('input[name="email"]').fill("not-an-email");
  await page.getByRole("button", { name: "Request localized preview" }).click();
  await expect(page).toHaveURL(new URL("/fixtures/showcase/marketing", page.url()).toString());
  await expect
    .poll(() =>
      page
        .locator('input[name="email"]')
        .evaluate((input: HTMLInputElement) => input.validity.typeMismatch),
    )
    .toBe(true);

  await page.locator('input[name="email"]').fill("buyer@example.com");
  await page.locator('input[name="email"]').press("Enter");
  await expect(page).toHaveURL(
    new URL(
      "/fixtures/showcase/marketing/contact/thanks?source=form#thanks",
      page.url(),
    ).toString(),
  );
  await expect(page.getByRole("heading", { name: "Preview request received" })).toBeVisible();

  expect(fixtureFailures).toEqual([]);
});

test("showcase app fixture runs non-eval interactivity", async ({ page }) => {
  const fixtureFailures = collectFixtureFailures(page);

  await page.goto("/fixtures/showcase/app/dashboard");
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
  expect(fixtureFailures).toEqual([]);
});

test("showcase docs fixture resolves nested base and relative links in the browser", async ({
  page,
}) => {
  const fixtureFailures = collectFixtureFailures(page);

  await page.goto("/fixtures/showcase/docs/start");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "docs");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(
    page.getByRole("heading", { name: "Set up translated docs without breaking references" }),
  ).toBeVisible();

  const apiHref = await page
    .locator('[data-check="docs-api"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(apiHref).toBe(
    new URL("/fixtures/showcase/docs/api?topic=keys#authentication", page.url()).toString(),
  );

  const parentHref = await page
    .locator('[data-check="docs-marketing"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(parentHref).toBe(new URL("/fixtures/showcase/marketing?from=docs", page.url()).toString());

  const deepRelativeHref = await page
    .locator('[data-check="docs-deep-relative"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(deepRelativeHref).toBe(
    new URL("/fixtures/showcase/marketing/pricing?from=docs#buy", page.url()).toString(),
  );

  const sourceOnlyHref = await page
    .locator('[data-check="docs-source-fallback"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(sourceOnlyHref).toBe(
    new URL("/fixtures/showcase/docs/source-only?from=docs#legacy", page.url()).toString(),
  );

  const fragmentHref = await page
    .locator('[data-check="docs-fragment"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(fragmentHref).toBe(
    new URL("/fixtures/showcase/docs/#authentication", page.url()).toString(),
  );

  await clickAndExpect(
    page,
    '[data-check="docs-api"]',
    new URL("/fixtures/showcase/docs/api?topic=keys#authentication", page.url()).toString(),
    "API reference for localized docs",
  );

  await page.goto("/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-deep-relative"]',
    new URL("/fixtures/showcase/marketing/pricing?from=docs#buy", page.url()).toString(),
    "Pricing that keeps translated links stable",
  );

  await page.goto("/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-source-fallback"]',
    new URL("/fixtures/showcase/docs/source-only?from=docs#legacy", page.url()).toString(),
    "Legacy docs source-only page",
  );

  await page.goto("/fixtures/showcase/docs/start");
  await clickAndExpect(
    page,
    '[data-check="docs-fragment"]',
    new URL("/fixtures/showcase/docs#authentication", page.url()).toString(),
    "Docs fixture root with anchor target",
  );

  expect(fixtureFailures).toEqual([]);
});
