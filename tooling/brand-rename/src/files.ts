import { execFileSync } from "node:child_process";

// Files and folders a rename leaves alone, and why. The lock file and the migration snapshots are generated and are made again by their own
// tools; the migrations are history (the schema is renamed by a new migration, not by editing the ones already applied); this tool's own
// folder holds the old names as the data it works from.
const excluded = [
  "pnpm-lock.yaml",
  "packages/database/migrations/",
  "tooling/brand-rename/",
] as const;

export function isExcluded(path: string): boolean {
  return (
    path.endsWith("/snapshot.json") ||
    excluded.some((entry) =>
      entry.endsWith("/") ? path.startsWith(entry) : path === entry,
    )
  );
}

// A file is text when its first 8 KiB holds no NUL byte; images, fonts, WebAssembly and video all do.
export function isText(content: Buffer): boolean {
  return !content.subarray(0, 8192).includes(0);
}

// Every file git tracks, relative to `root`: a rename never touches what the repository does not hold (build output, dependencies).
export function trackedFiles(root: string): readonly string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((path) => path !== "");
}
