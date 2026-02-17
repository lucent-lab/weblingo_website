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
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "All sites" })).toBeVisible();
  });

  test("navigates site detail and pages pagination", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}`);
    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();

    await page.goto(`/dashboard/sites/${SITE_ID}/pages`);
    await expect(page.getByRole("heading", { name: "Pages summary" })).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/sites/${SITE_ID}/pages\\?page=2$`));
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
  });

  test("shows domain verify/provision/refresh feedback", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}`);

    await page.getByRole("button", { name: "Provision domain" }).click();
    await expectToast(page, "Provisioning requested for pending.example.test.");

    await page.getByRole("button", { name: "Check DNS" }).click();
    await expectToast(page, "Refresh requested for pending.example.test.");

    await page.getByRole("button", { name: "Check now" }).click();
    await expectToast(page, "Domain verified: verify.example.test. Crawl enqueued.");
  });

  test("shows crawl + translate trigger feedback", async ({ page }) => {
    await page.goto(`/dashboard/sites/${SITE_ID}/admin`);
    await page.getByRole("button", { name: "Force full website crawl" }).click();
    await expectToast(page, "Crawl enqueued.");

    await page.goto(`/dashboard/sites/${SITE_ID}`);
    await page.getByRole("button", { name: "Translate & serve" }).first().click();
    await expectToast(page, /Translation run started\./);
  });
});
