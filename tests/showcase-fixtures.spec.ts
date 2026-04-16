import { expect, test } from "@playwright/test";

test("showcase marketing fixture exposes link, metadata, and asset sentinels", async ({ page }) => {
  const failedFixtureAssets: Array<{ url: string; status: number }> = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/fixtures/showcase/") && response.status() >= 400) {
      failedFixtureAssets.push({ url, status: response.status() });
    }
  });

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

  const sourceFallbackHref = await page
    .locator('[data-check="source-fallback-root"]')
    .evaluate((anchor: HTMLAnchorElement) => anchor.href);
  expect(sourceFallbackHref).toBe(
    new URL("/fixtures/showcase/original-only?from=marketing#faq", page.url()).toString(),
  );

  const cssBackgroundImage = await page
    .locator(".fixture-shell")
    .evaluate((element) => getComputedStyle(element, "::before").backgroundImage);
  expect(cssBackgroundImage).toContain("/fixtures/showcase/logo.svg");
  expect(failedFixtureAssets).toEqual([]);
});

test("showcase app fixture runs non-eval interactivity", async ({ page }) => {
  await page.goto("/fixtures/showcase/app/dashboard");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("data-weblingo-showcase-fixture", "app");
  await expect(page.locator("html")).toHaveAttribute("data-fixture-script-ready", "1");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer closed");

  await page.locator("[data-fixture-toggle]").click();

  await expect(page.locator("[data-fixture-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-fixture-output]")).toHaveText("Drawer open");
});

test("showcase docs fixture resolves nested base and relative links in the browser", async ({
  page,
}) => {
  const failedFixtureAssets: Array<{ url: string; status: number }> = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/fixtures/showcase/") && response.status() >= 400) {
      failedFixtureAssets.push({ url, status: response.status() });
    }
  });

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
  expect(failedFixtureAssets).toEqual([]);
});
