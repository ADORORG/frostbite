import { cp, mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";

import type { ScaffoldPaths } from "../../src/scaffold.ts";

const repository = join(import.meta.dirname, "../../../..");
const skipped = new Set(["node_modules", "coverage", ".turbo"]);

export interface ScaffoldWorkspace {
  readonly root: string;
  readonly paths: ScaffoldPaths;
}

// A copy of the parts of the repository a new game touches, inside this package so the game's imports resolve.
export async function makeScaffoldWorkspace(): Promise<ScaffoldWorkspace> {
  const root = await mkdtemp(join(import.meta.dirname, "../..", ".tmp-"));
  await cp(
    join(repository, "tooling/game-tools/template"),
    join(root, "template"),
    {
      filter: (source) => !skipped.has(source.split("/").pop() ?? ""),
      recursive: true,
    },
  );
  await mkdir(join(root, "configs/games"), { recursive: true });
  for (const file of ["games.ts", "chains.ts", "beta-chains.ts"])
    await cp(join(repository, "configs", file), join(root, "configs", file));
  return {
    root,
    paths: {
      gamesDirectory: join(root, "games"),
      manifestDirectory: join(root, "configs/games"),
      registryFile: join(root, "configs/games.ts"),
      templateDirectory: join(root, "template/game"),
      templateManifestFile: join(root, "template/manifest.ts"),
    },
  };
}
