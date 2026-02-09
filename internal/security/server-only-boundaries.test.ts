import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");

const CLIENT_DIRECTIVE = `"use client";`;

const SERVER_ONLY_IMPORT_PATTERNS = [
  `@/lib/supabase/admin`,
  `@internal/billing/stripe`,
  `@internal/core/env-server`,
  `@internal/core/redis`,
];

const SERVER_ONLY_IDENTIFIER_PATTERNS = [
  "envServer",
  "SUPABASE_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TRY_NOW_TOKEN",
];

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    if (entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listSourceFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function isClientComponentSource(source: string): boolean {
  // Client directive must appear before any other statement.
  const prefix = source.slice(0, 200);
  return prefix.includes(CLIENT_DIRECTIVE);
}

describe("server-only boundaries", () => {
  it("prevents importing server-only modules into client components", async () => {
    const roots = ["app", "components", "internal", "lib", "modules"].map((dir) =>
      path.join(REPO_ROOT, dir),
    );
    const filesNested = await Promise.all(roots.map((dir) => listSourceFiles(dir)));
    const files = filesNested.flat();

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      if (!isClientComponentSource(source)) {
        continue;
      }

      for (const pattern of SERVER_ONLY_IMPORT_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push({ file, pattern });
        }
      }

      for (const pattern of SERVER_ONLY_IDENTIFIER_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push({ file, pattern });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
