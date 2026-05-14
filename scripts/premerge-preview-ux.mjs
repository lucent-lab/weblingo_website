#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, options = {}) {
  const result = spawnSync(pnpm, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...options.env,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(["exec", "playwright", "test", "tests/preview-ui/preview-flow.spec.ts"]);

if (process.env.WEBLINGO_LIVE_PREVIEW_QA !== "1") {
  console.log(
    "Skipping live translated-preview UX probes. Set WEBLINGO_LIVE_PREVIEW_QA=1 and PREVIEW_UX_CASES_JSON to enable them.",
  );
  process.exit(0);
}

if (!process.env.PREVIEW_UX_CASES_JSON) {
  console.error("WEBLINGO_LIVE_PREVIEW_QA=1 requires PREVIEW_UX_CASES_JSON.");
  process.exit(1);
}

run(["exec", "playwright", "test", "tests/preview-live/translated-preview-runtime.spec.ts"]);
