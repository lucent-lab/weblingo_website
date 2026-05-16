import { expect, test } from "@playwright/test";

test("hydration rotator fixture cycles states and serves route data", async ({ page }) => {
  const routeDataRequests: string[] = [];
  const routeDataResponses: string[] = [];
  const badRouteDataResponses: string[] = [];
  const failedRouteData: string[] = [];

  function isRotatorRouteDataUrl(rawUrl: string): boolean {
    const url = new URL(rawUrl);
    return url.pathname === "/fixtures/hydration/rotator" && url.searchParams.has("_rsc");
  }

  page.on("request", (request) => {
    if (isRotatorRouteDataUrl(request.url())) {
      routeDataRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (isRotatorRouteDataUrl(response.url())) {
      routeDataResponses.push(response.url());
      if (response.status() >= 400) {
        badRouteDataResponses.push(`${response.status()} ${response.url()}`);
      }
      const routeDataHeader = response.headers()["x-weblingo-fixture-route-data"];
      if (routeDataHeader !== "1") {
        badRouteDataResponses.push(`missing route-data header ${response.url()}`);
      }
    }
  });
  page.on("requestfailed", (request) => {
    if (isRotatorRouteDataUrl(request.url())) {
      failedRouteData.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`);
    }
  });

  const response = await page.goto("/fixtures/hydration/rotator");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");

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
  expect(routeDataRequests.length, "fixture should request same-origin route data").toBeGreaterThan(
    0,
  );
  expect(
    routeDataResponses.length,
    "fixture should receive same-origin route data",
  ).toBeGreaterThan(0);
  expect(badRouteDataResponses).toEqual([]);
  expect(failedRouteData).toEqual([]);
});
