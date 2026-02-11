#!/usr/bin/env node

"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

function ensureNextRouteTypes(baseDir) {
  const routesFiles = [
    path.join(baseDir, ".next", "types", "routes.d.ts"),
    // Next 16+ writes dev-only route types under `.next/dev/types`.
    path.join(baseDir, ".next", "dev", "types", "routes.d.ts"),
  ];

  for (const routesFile of routesFiles) {
    const typesDir = path.dirname(routesFile);
    fs.mkdirSync(typesDir, { recursive: true });

    if (fs.existsSync(routesFile)) {
      continue;
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
}

const baseDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
ensureNextRouteTypes(baseDir);
