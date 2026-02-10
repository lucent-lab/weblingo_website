#!/usr/bin/env node
import { readFileSync } from "node:fs";

function readJson(path) {
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`[licenses] Failed to parse JSON at ${path}: ${reason}`);
  }
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: node scripts/check-licenses.mjs <licenses.json>");
  }

  const data = readJson(inputPath);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("[licenses] Expected a JSON object mapping license -> packages");
  }

  const forbidden = [];
  for (const license of Object.keys(data)) {
    const upper = String(license).toUpperCase();
    // Hard fail for copyleft licenses that are typically incompatible with SaaS/commercial distribution.
    // Note: LGPL is not treated as forbidden here (Next.js image optimization often pulls libvips via sharp).
    if (upper.startsWith("AGPL") || upper.startsWith("GPL")) {
      forbidden.push(license);
    }
  }

  if (forbidden.length) {
    console.error("[licenses] Forbidden licenses detected:", forbidden.sort().join(", "));
    process.exitCode = 1;
    return;
  }

  console.info("[licenses] ok");
}

main();
