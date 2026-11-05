import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { discoverWorkspaces } from "../src/workspaces.ts";

const roots: string[] = [];

async function repository(
  workspacePattern: string,
  packageJson: object,
  packageDirectory = "packages/example",
): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), "workspace-policy-"));
  roots.push(root);
  await writeFile(
    root + "/pnpm-workspace.yaml",
    `packages:\n  - "${workspacePattern}"\n`,
  );
  await mkdir(`${root}/${packageDirectory}`, { recursive: true });
  await writeFile(
    `${root}/${packageDirectory}/package.json`,
    JSON.stringify(packageJson),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("workspace discovery", () => {
  it("discovers named packages and defaults absent scripts", async () => {
    const root = await repository("packages/*", { name: "example" });
    await expect(discoverWorkspaces(root)).resolves.toEqual([
      {
        directory: resolve(root, "packages/example"),
        name: "example",
        scripts: {},
      },
    ]);
  });

  it("discovers explicit two-level provider packages", async () => {
    const root = await repository(
      "providers/*/*",
      { name: "nested-provider" },
      "providers/object-storage/r2",
    );
    await expect(discoverWorkspaces(root)).resolves.toEqual([
      {
        directory: resolve(root, "providers/object-storage/r2"),
        name: "nested-provider",
        scripts: {},
      },
    ]);
  });

  it("accepts a directory named in full, not only a glob", async () => {
    const root = await repository(
      "configs",
      { name: "@repo/configs" },
      "configs",
    );
    expect(await discoverWorkspaces(root)).toEqual([
      {
        directory: resolve(root, "configs"),
        name: "@repo/configs",
        scripts: {},
      },
    ]);
  });

  it("rejects unsupported nested globs", async () => {
    const root = await repository("packages/**", { name: "example" });
    await expect(discoverWorkspaces(root)).rejects.toThrow(
      "Unsupported workspace pattern",
    );
  });

  it("rejects unnamed packages", async () => {
    const root = await repository("packages/*", {});
    await expect(discoverWorkspaces(root)).rejects.toThrow(
      "must declare a package name",
    );
  });
});
