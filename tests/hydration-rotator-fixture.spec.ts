import { expect, test } from "@playwright/test";

test("hydration rotator fixture cycles states and serves route data", async ({ page }) => {
  const failedRouteData: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === "/fixtures/hydration/rotator" && url.searchParams.has("_rsc")) {
      if (response.status() >= 400) {
        failedRouteData.push(`${response.status()} ${response.url()}`);
      }
    }
  });

  await page.goto("/fixtures/hydration/rotator");

  const rotator = page.getByTestId("fixture-client-rotator");
  await expect(rotator).toBeVisible();
  await expect(rotator).toContainText("conversions");

  await expect
    .poll(async () => rotator.getAttribute("data-rotator-tick"), {
      message: "source app interval should keep updating the visible rotator",
    })
    .not.toBe("0");

  const observed = new Set<string>();
  for (let index = 0; index < 12; index += 1) {
    observed.add((await rotator.locator(".rotator-word").innerText()).trim());
    await page.waitForTimeout(250);
  }

  expect(observed).toEqual(new Set(["conversions", "bookings", "signups", "revenue"]));
  await expect(rotator.locator(".rotator-word-incoming")).toHaveCount(0);
  expect(failedRouteData).toEqual([]);
});
