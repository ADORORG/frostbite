import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "target",
]);
// Generated output that is built from reviewed source elsewhere and never edited: the games the web app serves.
const generatedDirectories = new Set(["apps/web/public/play"]);
const sourceExtensions = new Set([".css", ".js", ".mjs", ".rs", ".ts", ".tsx"]);

export async function listSourceFiles(
  root: string,
): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!generatedDirectories.has(relative(root, path))) await visit(path);
      } else if (entry.isFile() && sourceExtensions.has(extname(entry.name)))
        files.push(path);
    }
  }

  await visit(root);
  return files.sort();
}

export async function physicalLineCount(path: string): Promise<number> {
  const contents = await readFile(path, "utf8");
  if (contents.length === 0) return 0;
  return contents.split(/\r?\n/).length - (contents.endsWith("\n") ? 1 : 0);
}
