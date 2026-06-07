import { describe, expect, it } from "vitest";

import { normalizeValidationMarker } from "./validation-marker";

describe("QA validation marker helpers", () => {
  it.each([
    ["qa-m6521-20260607", "qa-m6521-20260607"],
    [" qa.preview:run_01 ", "qa.preview:run_01"],
    ["qa.marker.with.dots", "qa.marker.with.dots"],
  ])("accepts safe marker %s", (input, expected) => {
    expect(normalizeValidationMarker(input)).toBe(expected);
  });

  it.each([
    "",
    " ",
    "qa marker",
    "qa/marker",
    "qa?marker=1",
    "qa@example.com",
    "token=secret",
    "qa-マーカー",
    "a".repeat(81),
  ])("drops unsafe marker %s", (input) => {
    expect(normalizeValidationMarker(input)).toBeNull();
  });
});
