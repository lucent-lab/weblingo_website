import { describe, expect, it } from "vitest";
import { hasExplicitFailure, resolveStatusCheckFailure } from "./preview-sse";

describe("hasExplicitFailure", () => {
  it("returns false for error-only payloads", () => {
    expect(hasExplicitFailure({ error: "Preview not found" })).toBe(false);
    expect(hasExplicitFailure({ message: "Temporary read error" })).toBe(false);
  });

  it("returns true for failed status payloads", () => {
    expect(hasExplicitFailure({ status: "failed" })).toBe(true);
  });

  it("returns true for explicit error codes and stages", () => {
    expect(hasExplicitFailure({ errorCode: "preview_expired" })).toBe(true);
    expect(hasExplicitFailure({ errorStage: "saving" })).toBe(true);
  });

  it("returns true for explicit details error codes", () => {
    expect(hasExplicitFailure({ details: { errorCode: "preview_not_found" } })).toBe(true);
  });
});

describe("resolveStatusCheckFailure", () => {
  it("treats explicit failure payloads as terminal", () => {
    expect(resolveStatusCheckFailure(503, { errorCode: "preview_expired" })).toBe("terminal");
  });

  it("treats 5xx and 429 as processing when payload is not explicit", () => {
    expect(resolveStatusCheckFailure(503, { error: "upstream" })).toBe("processing");
    expect(resolveStatusCheckFailure(429, null)).toBe("processing");
  });

  it("treats non-5xx non-429 without explicit failure as terminal", () => {
    expect(resolveStatusCheckFailure(404, null)).toBe("terminal");
  });
});
