import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("hydration rotator fixture", () => {
  it("serves the client-owned rotator document", async () => {
    const response = await GET(new Request("https://weblingo.app/fixtures/hydration/rotator"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-hydration-fixture")).toBe("rotator");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toContain("script-src");
    expect(html).toContain('data-testid="fixture-client-rotator"');
    expect(html).toContain("Turn international traffic into");
    expect(html).toContain("bookings");
    expect(html).toContain("setInterval");
  });

  it("serves same-origin route-data requests", async () => {
    const response = await GET(
      new Request("https://weblingo.app/fixtures/hydration/rotator?_rsc=fixture", {
        headers: {
          RSC: "1",
          Accept: "text/x-component",
        },
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/x-component; charset=utf-8");
    expect(response.headers.get("x-weblingo-fixture-route-data")).toBe("1");
    expect(body).toContain("bookings");
    expect(body).toContain("revenue");
  });
});
