import { expect, test } from "@playwright/test";

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

test("home page exposes the try form", async ({ page }) => {
  const consoleErrors: string[] = [];
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
  await expect(page.getByTestId("hero-outcome-rotator")).toBeVisible();
  await expect(page.locator("h1")).toContainText("block your next market.");
  await expect(
    page.getByText(
      "WebLingo turns public pages into crawlable localized versions you can review before rollout.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "For public pages only. Excludes checkout, accounts, personalization, and real-time flows.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("URL")).toBeVisible();
  await expect(page.getByLabel("Source language")).toBeVisible();
  await expect(page.getByLabel("Target language")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText("Public pages", { exact: true })).toBeVisible();
  await expect(page.getByText("Search-ready output")).toBeVisible();
  await expect(page.getByText("Control before rollout")).toBeVisible();
  await expect(page.getByPlaceholder("https://example.jp")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate a private preview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Generate a private preview" })).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Talk through a rollout" })).toHaveCount(1);

  const bodyText = await page.locator("body").innerText();
  for (const blocked of blockedLaunchStrings) {
    expect(bodyText).not.toContain(blocked);
  }
  expect(bodyText).not.toMatch(/\b0(?:\+|%)/);
  expect(consoleErrors).toEqual([]);
});

test("expansion landing page renders core sections", async ({ page }) => {
  const consoleErrors: string[] = [];
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
  await expect(page.getByTestId("hero-outcome-rotator")).toBeVisible();
  await expect(page.locator("h1")).toContainText("block your next market.");
  await expect(
    page.getByText(
      "WebLingo turns public pages into crawlable localized versions you can review before rollout.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Public pages decide market trust")).toBeVisible();
  await expect(page.getByTestId("social-proof-callout")).toBeVisible();
  await expect(page.getByTestId("how-steps-timeline")).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  for (const blocked of blockedLaunchStrings) {
    expect(bodyText).not.toContain(blocked);
  }
  expect(bodyText).not.toMatch(/\b0(?:\+|%)/);
  expect(consoleErrors).toEqual([]);
});
