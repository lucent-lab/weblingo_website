import { describe, expect, it } from "vitest";

import { buildErrorLogFields } from "./error-log";

describe("buildErrorLogFields", () => {
  it("extracts error and cause metadata from nested error objects", () => {
    const error = new Error("fetch failed");
    (error as Error & { cause?: unknown; code?: string }).code = "FETCH_FAILED";
    (error as Error & { cause?: unknown }).cause = {
      message: "getaddrinfo ENOTFOUND example.upstash.io",
      name: "SystemError",
      code: "ENOTFOUND",
      errno: -3008,
      syscall: "getaddrinfo",
      hostname: "example.upstash.io",
    };

    expect(buildErrorLogFields(error)).toMatchObject({
      error: "fetch failed",
      error_name: "Error",
      error_code: "FETCH_FAILED",
      error_cause: "getaddrinfo ENOTFOUND example.upstash.io",
      error_cause_name: "SystemError",
      error_cause_code: "ENOTFOUND",
      error_cause_errno: -3008,
      error_cause_syscall: "getaddrinfo",
      error_cause_hostname: "example.upstash.io",
    });
  });

  it("handles non-error values", () => {
    expect(buildErrorLogFields("boom")).toEqual({ error: "boom" });
  });
});
