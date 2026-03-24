import { spawnSync } from "node:child_process";

const corepackCommand = process.platform === "win32" ? "corepack.cmd" : "corepack";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.WEBLINGO_REPO_PATH) {
  console.info("[check:ci] WEBLINGO_REPO_PATH is not set; skipping docs:sync:check.");
  process.exit(0);
}

run(corepackCommand, ["pnpm", "docs:sync:check"], {
  ...process.env,
  WEBLINGO_REPO_PATH: process.env.WEBLINGO_REPO_PATH,
});
