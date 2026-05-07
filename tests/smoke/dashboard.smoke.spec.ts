import { expect, test, type Page } from "@playwright/test";

const SITE_ID = "site-smoke-1";

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible();
}

test.describe("dashboard smoke", () => {
  test.skip(
    process.env.DASHBOARD_E2E_MOCK !== "1",
    "Dashboard smoke requires DASHBOARD_E2E_MOCK=1.",
  );

  test("loads the dashboard overview shell", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Manage" })).toBeVisible();
  });

  test("navigates site detail and pages pagination", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}`);
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Languages" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/pages`);
    await expect(page.getByRole("heading", { name: "Pages summary" })).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/sites/${SITE_ID}/pages\\?page=2$`));
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
  });

  test("keeps overview first paint free of inline domain and translate mutations", async ({
    page,
  }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}`);

    await expect(page.getByRole("heading", { name: "Verify a domain" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Provision domain" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Check DNS" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Translate & serve" })).toHaveCount(0);
  });

  test("loads focused dashboard routes", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}/domains`);
    await expect(page.getByRole("heading", { name: "Domains" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Check DNS" }).first()).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/settings`);
    await expect(page.getByRole("heading", { name: "Settings" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Runtime", exact: true })).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/developer-tools`);
    await expect(page.getByRole("heading", { name: "Developer tools" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open runtime requests" })).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/runtime-requests`);
    await expect(page.getByRole("heading", { name: "Runtime requests" }).first()).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/quality`);
    await expect(page.getByRole("heading", { name: "Quality" }).first()).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/history?targetLang=fr`);
    await expect(page.getByRole("heading", { name: "History" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Translation runs" })).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/history?targetLang=fr&historyType=deployments`);
    await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible();
  });

  test("shows focused crawl trigger feedback", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}/pages`);
    await page.getByRole("button", { name: "Force full website crawl" }).click();
    await expectToast(page, "Crawl enqueued.");

    await page.getByRole("button", { name: "Force crawl" }).first().click();
    await expectToast(page, "Page crawl enqueued.");
  });
});
