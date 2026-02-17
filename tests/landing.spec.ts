import { expect, test } from "@playwright/test";

test("home page exposes the try form", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByPlaceholder("https://example.jp")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate preview" })).toBeVisible();
});

test("expansion landing page renders core sections", async ({ page }) => {
  await page.goto("/en/landing/expansion");
  await expect(
    page.getByRole("heading", { name: "Turn international traffic into conversions and revenue." }),
  ).toBeVisible();
  await expect(page.getByText("The cost of staying single-language")).toBeVisible();
});
