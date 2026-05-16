import { expect, test, type Page } from "@playwright/test";

const blockedLaunchStrings = [
  "AI translation, human proof",
  "Free hosting included",
  "Cancel anytime",
  "No traffic quotas",
  "No traffic or bandwidth quotas",
  "Daily auto-crawl",
  "stays in sync automatically",
  "WebLingo is almost ready",
  "Final boarding call",
  "free-month code",
  "10 client websites",
  "Generate preview",
  "Try your URL now",
  "Notify me",
];

async function stubAnalyticsProxy(page: Page) {
  await page.route("**/api/analytics/posthog/**", async (route) => {
    const url = new URL(route.request().url());
    const isScriptRequest = url.pathname.endsWith(".js") || url.pathname.includes("/array/");
    if (isScriptRequest) {
      await route.fulfill({
        body: "",
        contentType: "application/javascript; charset=utf-8",
        status: 200,
      });
      return;
    }
    await route.fulfill({ status: 204 });
  });
}

test("home page exposes the try form", async ({ page }) => {
  const consoleErrors: string[] = [];
  await stubAnalyticsProxy(page);
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (text.includes("favicon.ico")) {
      return;
    }
    consoleErrors.push(text);
  });

  await page.goto("/en");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByLabel("URL")).toBeVisible();
  await expect(page.getByLabel("Source language")).toBeVisible();
  await expect(page.getByLabel("Target language")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByPlaceholder("https://example.jp")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate a private preview" })).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  for (const blocked of blockedLaunchStrings) {
    expect(bodyText).not.toContain(blocked);
  }
  expect(bodyText).not.toMatch(/\b0(?:\+|%)/);
  expect(consoleErrors).toEqual([]);
});

test("expansion landing page renders core sections", async ({ page }) => {
  const consoleErrors: string[] = [];
  await stubAnalyticsProxy(page);
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (text.includes("favicon.ico")) {
      return;
    }
    consoleErrors.push(text);
  });

  await page.goto("/en/landing/expansion");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByTestId("social-proof-callout")).toBeVisible();
  await expect(page.getByTestId("how-steps-timeline")).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  for (const blocked of blockedLaunchStrings) {
    expect(bodyText).not.toContain(blocked);
  }
  expect(bodyText).not.toMatch(/\b0(?:\+|%)/);
  expect(consoleErrors).toEqual([]);
});
