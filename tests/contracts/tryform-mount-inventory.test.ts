import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function listTrackedTryFormMounts(): string[] {
  const output = execSync(
    'git grep -l -E "<TryForm|TryForm\\(" -- app modules',
    { encoding: "utf8" },
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
}

describe("TryForm mount inventory", () => {
  it("matches the tracked mount inventory baseline", () => {
    expect(listTrackedTryFormMounts()).toEqual([
      "app/[locale]/(marketing)/try/page.tsx",
      "modules/home/classic-home.tsx",
      "modules/landing-variants/variant-1.tsx",
      "modules/landing-variants/variant-10.tsx",
      "modules/landing-variants/variant-11.tsx",
      "modules/landing-variants/variant-12.tsx",
      "modules/landing-variants/variant-13.tsx",
      "modules/landing-variants/variant-14.tsx",
      "modules/landing-variants/variant-15.tsx",
      "modules/landing-variants/variant-16.tsx",
      "modules/landing-variants/variant-17.tsx",
      "modules/landing-variants/variant-18.tsx",
      "modules/landing-variants/variant-19.tsx",
      "modules/landing-variants/variant-2.tsx",
      "modules/landing-variants/variant-20.tsx",
      "modules/landing-variants/variant-3.tsx",
      "modules/landing-variants/variant-4.tsx",
      "modules/landing-variants/variant-5.tsx",
      "modules/landing-variants/variant-6.tsx",
      "modules/landing-variants/variant-7.tsx",
      "modules/landing-variants/variant-8.tsx",
      "modules/landing-variants/variant-9.tsx",
      "modules/landing/segment-page.tsx",
    ]);
  });
});
