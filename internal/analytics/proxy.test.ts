import { describe, expect, it } from "vitest";

import {
  buildPosthogProxyApiHost,
  buildPosthogProxyRequestHeaders,
  buildPosthogProxyResponseHeaders,
  buildPosthogUpstreamUrl,
  shouldForwardRequestBody,
} from "./proxy";

describe("PostHog proxy helpers", () => {
  it("builds the first-party proxy api host from the app URL", () => {
    expect(buildPosthogProxyApiHost("https://weblingo.app")).toBe(
      "https://weblingo.app/_analytics/posthog",
    );
    expect(buildPosthogProxyApiHost("https://weblingo.app/")).toBe(
      "https://weblingo.app/_analytics/posthog",
    );
  });

  it("builds upstream urls with preserved query strings", () => {
    expect(
      buildPosthogUpstreamUrl(
        "https://eu.i.posthog.com/ingest/",
        ["e"],
        "https://weblingo.app/_analytics/posthog/e/?v=2&compression=gzip",
      ).toString(),
    ).toBe("https://eu.i.posthog.com/ingest/e?v=2&compression=gzip");
  });

  it("filters hop-by-hop request headers and sets forwarded headers", () => {
    const headers = buildPosthogProxyRequestHeaders(
      new Headers({
        authorization: "Bearer secret",
        connection: "keep-alive",
        "content-length": "123",
        "content-type": "application/json",
        cookie: "session=secret",
        host: "weblingo.app",
        referer: "https://weblingo.app/dashboard",
      }),
      "https://weblingo.app/_analytics/posthog/e",
    );

    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("host")).toBeNull();
    expect(headers.get("referer")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-forwarded-host")).toBe("weblingo.app");
    expect(headers.get("x-forwarded-proto")).toBe("https");
  });

  it("filters hop-by-hop response headers", () => {
    const headers = buildPosthogProxyResponseHeaders(
      new Headers({
        connection: "close",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
      }),
    );

    expect(headers.get("connection")).toBeNull();
    expect(headers.get("transfer-encoding")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("forwards bodies only for non-GET/HEAD methods", () => {
    expect(shouldForwardRequestBody("GET")).toBe(false);
    expect(shouldForwardRequestBody("HEAD")).toBe(false);
    expect(shouldForwardRequestBody("POST")).toBe(true);
  });
});
