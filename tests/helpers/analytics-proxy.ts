import type { Page } from "@playwright/test";

export async function stubPosthogAnalyticsProxy(page: Page): Promise<void> {
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
