import { describe, expect, it } from "vitest";
import { hasExplicitFailure } from "./preview-sse";

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
