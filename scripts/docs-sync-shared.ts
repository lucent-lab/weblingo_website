import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

export const REQUIRED_BACKEND_FILES = [
  "docs/reference/openapi.json",
  "docs/reference/feature-catalog.generated.json",
  "docs/reference/API_PLAYBOOKS.md",
] as const;

export const GENERATED_DOCS_DIR = "content/docs/_generated";

export const SNAPSHOT_FILE_PATHS = {
  openApi: `${GENERATED_DOCS_DIR}/backend-openapi.snapshot.json`,
  featureCatalog: `${GENERATED_DOCS_DIR}/backend-feature-catalog.snapshot.json`,
  playbooks: `${GENERATED_DOCS_DIR}/backend-playbooks.snapshot.md`,
  manifest: `${GENERATED_DOCS_DIR}/backend-sync-manifest.json`,
} as const;

type SnapshotMap = Record<string, string>;

type HashedFile = {
  bytes: number;
  sha256: string;
};

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const source = value as Record<string, unknown>;
  const sortedKeys = Object.keys(source).sort((left, right) => left.localeCompare(right));
  const out: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    out[key] = stableSortValue(source[key]);
  }
  return out;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableSortValue(value), null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readRequiredBackendFile(repoPath: string, relativePath: string): string {
  const absolutePath = path.join(repoPath, relativePath);
  return readFileSync(absolutePath, "utf8");
}

function gitOutput(repoPath: string, args: string[]): string {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function resolveWeblingoRepoPathOrThrow(cwd = process.cwd()): string {
  const configured = process.env.WEBLINGO_REPO_PATH?.trim();
  if (!configured) {
    throw new Error(
      "[docs-sync] WEBLINGO_REPO_PATH is required. Example: WEBLINGO_REPO_PATH=/absolute/path/to/weblingo pnpm docs:sync",
    );
  }

  const absolutePath = path.resolve(cwd, configured);
  if (!existsSync(absolutePath)) {
    throw new Error(`[docs-sync] WEBLINGO_REPO_PATH does not exist: ${absolutePath}`);
  }

  const missing = REQUIRED_BACKEND_FILES.filter(
    (relativePath) => !existsSync(path.join(absolutePath, relativePath)),
  );
  if (missing.length > 0) {
    throw new Error(
      `[docs-sync] WEBLINGO_REPO_PATH is invalid (${absolutePath}). Missing required files:\n${missing
        .map((entry) => `- ${entry}`)
        .join("\n")}`,
    );
  }

  try {
    const isGitRepo = gitOutput(absolutePath, ["rev-parse", "--is-inside-work-tree"]);
    if (isGitRepo !== "true") {
      throw new Error("[docs-sync] WEBLINGO_REPO_PATH is not inside a git worktree.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[docs-sync] WEBLINGO_REPO_PATH must point to a git repository: ${message}`);
  }

  return absolutePath;
}

function buildSourceFileHashes(repoPath: string): Record<string, HashedFile> {
  const out: Record<string, HashedFile> = {};
  for (const relativePath of REQUIRED_BACKEND_FILES) {
    const raw = readRequiredBackendFile(repoPath, relativePath);
    const normalized = normalizeNewlines(raw);
    out[relativePath] = {
      bytes: Buffer.byteLength(normalized, "utf8"),
      sha256: sha256(normalized),
    };
  }
  return out;
}

function buildGeneratedFileHashes(snapshotMap: SnapshotMap): Record<string, HashedFile> {
  const out: Record<string, HashedFile> = {};
  for (const [relativePath, content] of Object.entries(snapshotMap)) {
    out[relativePath] = {
      bytes: Buffer.byteLength(content, "utf8"),
      sha256: sha256(content),
    };
  }
  return out;
}

export function buildSnapshots(repoPath: string): SnapshotMap {
  const openApiRaw = readRequiredBackendFile(repoPath, "docs/reference/openapi.json");
  const featureCatalogRaw = readRequiredBackendFile(
    repoPath,
    "docs/reference/feature-catalog.generated.json",
  );
  const playbooksRaw = readRequiredBackendFile(repoPath, "docs/reference/API_PLAYBOOKS.md");

  const openApiSnapshot = stableJson(JSON.parse(openApiRaw) as unknown);
  const featureCatalogSnapshot = stableJson(JSON.parse(featureCatalogRaw) as unknown);
  const playbooksSnapshot = ensureTrailingNewline(normalizeNewlines(playbooksRaw));

  const contentSnapshots: SnapshotMap = {
    [SNAPSHOT_FILE_PATHS.openApi]: openApiSnapshot,
    [SNAPSHOT_FILE_PATHS.featureCatalog]: featureCatalogSnapshot,
    [SNAPSHOT_FILE_PATHS.playbooks]: playbooksSnapshot,
  };

  const sourceRepoSha = gitOutput(repoPath, ["rev-parse", "HEAD"]);
  const sourceRepoCommitTimestamp = gitOutput(repoPath, ["show", "-s", "--format=%cI", "HEAD"]);

  const manifest = {
    schemaVersion: 1,
    sourceRepoPath: repoPath,
    sourceRepoSha,
    sourceRepoCommitTimestamp,
    generatedAt: sourceRepoCommitTimestamp,
    sourceFiles: buildSourceFileHashes(repoPath),
    generatedFiles: buildGeneratedFileHashes(contentSnapshots),
    requiredEnv: ["WEBLINGO_REPO_PATH"],
  };

  return {
    ...contentSnapshots,
    [SNAPSHOT_FILE_PATHS.manifest]: stableJson(manifest),
  };
}

export async function writeSnapshots(snapshotMap: SnapshotMap, cwd = process.cwd()): Promise<void> {
  for (const [relativePath, content] of Object.entries(snapshotMap)) {
    const absolutePath = path.resolve(cwd, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
}

export function readSnapshot(relativePath: string, cwd = process.cwd()): string | null {
  const absolutePath = path.resolve(cwd, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return readFileSync(absolutePath, "utf8");
}
