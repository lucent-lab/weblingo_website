import { expect, test } from "@playwright/test";

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
  await expect(page.getByPlaceholder("https://example.jp")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate preview" })).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Turn international traffic into conversions" }),
  ).toBeVisible();
  await expect(page.getByText("The cost of staying single-language")).toBeVisible();
  await expect(page.getByTestId("hero-outcome-rotator")).toBeVisible();
  await expect(page.getByTestId("social-proof-callout")).toBeVisible();
  await expect(page.getByTestId("how-steps-timeline")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
