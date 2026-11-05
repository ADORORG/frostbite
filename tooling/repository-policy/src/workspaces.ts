import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Workspace {
  readonly directory: string;
  readonly name: string;
  readonly scripts: Readonly<Record<string, string>>;
}

interface PackageJson {
  readonly name?: string;
  readonly scripts?: Readonly<Record<string, string>>;
}

function parseWorkspacePatterns(contents: string): readonly string[] {
  return contents
    .split("\n")
    .map((line) => /^\s*-\s+["']([^"']+)["']\s*$/.exec(line)?.[1])
    .filter((pattern): pattern is string => pattern !== undefined);
}

async function readPackage(directory: string): Promise<Workspace> {
  const packagePath = resolve(directory, "package.json");
  const parsed = JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;
  if (!parsed.name)
    throw new Error(`${packagePath} must declare a package name.`);
  return { directory, name: parsed.name, scripts: parsed.scripts ?? {} };
}

async function expandPattern(
  root: string,
  pattern: string,
): Promise<readonly string[]> {
  const segments = pattern.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 || (segment.includes("*") && segment !== "*"),
    )
  ) {
    throw new Error(`Unsupported workspace pattern: ${pattern}`);
  }

  let directories = [root];
  for (const segment of segments) {
    if (segment === "*") {
      const children = await Promise.all(
        directories.map(async (directory) =>
          (await readdir(directory, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => resolve(directory, entry.name)),
        ),
      );
      directories = children.flat();
    } else {
      directories = directories.map((directory) => resolve(directory, segment));
    }
  }
  return directories;
}

export async function discoverWorkspaces(
  root: string,
): Promise<readonly Workspace[]> {
  const workspaceFile = resolve(root, "pnpm-workspace.yaml");
  const patterns = parseWorkspacePatterns(
    await readFile(workspaceFile, "utf8"),
  );
  const directories: string[] = [];

  for (const pattern of patterns) {
    directories.push(...(await expandPattern(root, pattern)));
  }

  return Promise.all(directories.sort().map(readPackage));
}

export function repositoryRoot(moduleUrl: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "../../..");
}
