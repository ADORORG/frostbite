import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..", "..", "..");
const skipped = new Set([
  "node_modules",
  ".next",
  "coverage",
  "dist",
  ".turbo",
]);

/**
 * Workspaces whose vitest configuration is deliberately not the shared one, and why. A new entry
 * needs a reason a reviewer can accept.
 */
const ownConfig: Record<string, string> = {
  "packages/client-react/vitest.config.ts":
    "attaches the React plugin and a setup file to each project, which the shared options do not express",
  "packages/chain/vitest.regtest.config.ts":
    "runs one live-stack suite against a local chain on demand: no projects, no coverage, a long timeout, and it fails when the stack is down",
  "packages/eslint-config/vitest.config.js":
    "plain JavaScript package that cannot import a TypeScript config",
  "packages/typescript-config/vitest.config.ts":
    "tests the config files themselves and runs a fixed list of files",
  "packages/vitest-config/vitest.config.ts":
    "defines the shared config, so it imports it by path",
};

function configFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (skipped.has(name)) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return configFiles(path);
    return /^vitest\..*config\.[cm]?[jt]s$/.test(name) ? [path] : [];
  });
}

describe("shared vitest configuration adoption", () => {
  const files = configFiles(repositoryRoot).map((path) =>
    relative(repositoryRoot, path),
  );

  it("finds the workspaces' configuration files", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("uses the shared builder in every workspace that does not give a reason not to", () => {
    const unshared = files.filter(
      (file) =>
        !readFileSync(join(repositoryRoot, file), "utf8").includes(
          '"@repo/vitest-config"',
        ) && ownConfig[file] === undefined,
    );
    expect(unshared).toEqual([]);
  });

  it("lists no exception that is gone or has moved to the shared builder", () => {
    for (const file of Object.keys(ownConfig)) {
      expect(files).toContain(file);
      if (file.startsWith("packages/vitest-config/")) continue;
      expect(readFileSync(join(repositoryRoot, file), "utf8")).not.toContain(
        '"@repo/vitest-config"',
      );
    }
  });
});
