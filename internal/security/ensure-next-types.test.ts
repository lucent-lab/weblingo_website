import { describe, expect, it } from "vitest";

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts/ensure-next-types.cjs");

describe("scripts/ensure-next-types", () => {
  it("creates .next/types/routes.d.ts when missing", async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), "weblingo-website-"));
    const routesFile = path.join(tmpBase, ".next", "types", "routes.d.ts");

    expect(existsSync(routesFile)).toBe(false);

    await execFileAsync(process.execPath, [SCRIPT_PATH, tmpBase], {
      cwd: REPO_ROOT,
      env: process.env,
    });

    expect(existsSync(routesFile)).toBe(true);
    expect(await fs.readFile(routesFile, "utf8")).toContain("export {};");
  });
});
