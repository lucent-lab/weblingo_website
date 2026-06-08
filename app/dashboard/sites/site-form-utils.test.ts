import { describe, expect, it } from "vitest";

import { isValidManagedDemoWebsitePath } from "./site-form-utils";

describe("isValidManagedDemoWebsitePath", () => {
  it("accepts normalized showcase website paths", () => {
    expect(isValidManagedDemoWebsitePath("autotrim.com")).toBe(true);
    expect(isValidManagedDemoWebsitePath("demo-1.example.com")).toBe(true);
  });

  it("rejects placeholders and path separators", () => {
    expect(isValidManagedDemoWebsitePath("{lang}.example.com")).toBe(false);
    expect(isValidManagedDemoWebsitePath("%7Blang%7D.example.com")).toBe(false);
    expect(isValidManagedDemoWebsitePath("example.com/fr")).toBe(false);
    expect(isValidManagedDemoWebsitePath("example..com")).toBe(false);
  });
});
