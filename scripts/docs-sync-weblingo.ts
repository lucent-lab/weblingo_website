import { buildSnapshots, resolveWeblingoRepoPathOrThrow, writeSnapshots } from "./docs-sync-shared";

async function main(): Promise<void> {
  const sourceRepoPath = resolveWeblingoRepoPathOrThrow();
  const snapshots = buildSnapshots(sourceRepoPath);
  await writeSnapshots(snapshots);

  const writtenPaths = Object.keys(snapshots).sort((left, right) => left.localeCompare(right));
  console.info(`[docs:sync] Synced ${writtenPaths.length} file(s) from ${sourceRepoPath}:`);
  for (const relativePath of writtenPaths) {
    console.info(`- ${relativePath}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
