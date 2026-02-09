#!/usr/bin/env node

"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

function ensureNextRouteTypes(baseDir) {
  const typesDir = path.join(baseDir, ".next", "types");
  fs.mkdirSync(typesDir, { recursive: true });

  const routesFile = path.join(typesDir, "routes.d.ts");
  if (fs.existsSync(routesFile)) {
    return;
  }

  fs.writeFileSync(
    routesFile,
    [
      "// Auto-generated stub to keep `tsc --noEmit` working on fresh checkouts.",
      "// Next.js overwrites this during `next dev`/`next build`.",
      "export {};",
      "",
    ].join("\n"),
    { encoding: "utf8" },
  );
}

const baseDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
ensureNextRouteTypes(baseDir);
