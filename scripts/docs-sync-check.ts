import {
  buildSnapshots,
  readSnapshot,
  resolveWeblingoRepoPathOrThrow,
  SNAPSHOT_FILE_PATHS,
} from "./docs-sync-shared";

function quoteCommandPath(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

function main(): void {
  const sourceRepoPath = resolveWeblingoRepoPathOrThrow();
  const expectedSnapshots = buildSnapshots(sourceRepoPath);

  const stalePaths: string[] = [];
  for (const [relativePath, expectedContent] of Object.entries(expectedSnapshots)) {
    const currentContent = readSnapshot(relativePath);
    if (currentContent !== expectedContent) {
      stalePaths.push(relativePath);
    }
  }

  if (stalePaths.length > 0) {
    const refreshCommand = `WEBLINGO_REPO_PATH=${quoteCommandPath(sourceRepoPath)} pnpm docs:sync`;
    throw new Error(
      `[docs:sync:check] Stale or missing synced docs artifacts:\n${stalePaths
        .sort((left, right) => left.localeCompare(right))
        .map((entry) => `- ${entry}`)
        .join("\n")}\nRefresh with:\n${refreshCommand}`,
    );
  }

  const snapshotCount = Object.keys(SNAPSHOT_FILE_PATHS).length;
  console.info(`[docs:sync:check] Synced artifacts are up to date (${snapshotCount} files).`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
