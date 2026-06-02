import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { updateSession } from "./middleware";

function buildRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("updateSession", () => {
  it("rewrites the public demo dashboard outside the authenticated dashboard layout", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/demo?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token",
    );
  });

  it("rewrites the public demo dashboard with a trailing slash", async () => {
    const response = await updateSession(
      buildRequest("https://weblingo.app/dashboard/demo/?token=demo-token"),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://weblingo.app/demo-dashboard?token=demo-token",
    );
  });
});
