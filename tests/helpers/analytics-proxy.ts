import type { Page, Route } from "@playwright/test";

export async function stubPosthogAnalyticsProxy(page: Page): Promise<void> {
  const fulfillAnalyticsProxy = async (route: Route) => {
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
  };

  await page.route("**/_analytics/posthog/**", fulfillAnalyticsProxy);
  await page.route("**/api/analytics/posthog/**", fulfillAnalyticsProxy);
}
