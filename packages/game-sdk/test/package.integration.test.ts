import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import manifest from "../package.json" with { type: "json" };

// What a builder gets when the package is installed: built JavaScript with declarations, resolving nothing from
// this repository. (Installing the packed file in an empty project was also done by hand; this keeps the parts
// that can drift from drifting.)
const root = join(import.meta.dirname, "..");
let out: string;

beforeAll(async () => {
  out = await mkdtemp(join(tmpdir(), "game-sdk-package-"));
  execFileSync(
    join(root, "node_modules/.bin/tsc"),
    ["-p", "tsconfig.build.json", "--outDir", out],
    { cwd: root },
  );
}, 60_000);
afterAll(() => rm(out, { force: true, recursive: true }));

describe("the published package", () => {
  it("points every entry at a built file and its declarations, and every source entry has one", async () => {
    const entries = Object.entries(manifest.publishConfig.exports);
    expect(entries.map(([name]) => name).sort()).toEqual(
      Object.keys(manifest.exports).sort(),
    );
    const built = new Set(await readdir(out));
    for (const [, target] of entries) {
      expect(built.has(target.default.replace("./dist/", ""))).toBe(true);
      expect(built.has(target.types.replace("./dist/", ""))).toBe(true);
    }
  });

  it("imports only its own files, node's, and what it declares as dependencies", async () => {
    const allowed = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
    ]);
    for (const file of (await readdir(out)).filter((name) =>
      name.endsWith(".js"),
    )) {
      const source = await readFile(join(out, file), "utf8");
      for (const [, specifier] of source.matchAll(/from "([^"]+)"/gu)) {
        if (specifier === undefined) continue;
        if (specifier.startsWith("./")) {
          // A relative import must name the built file, not the source it came from.
          expect(specifier, file).toMatch(/\.js$/u);
        } else if (!specifier.startsWith("node:")) {
          expect(allowed.has(specifier), `${file} imports ${specifier}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("keeps esbuild optional, because only the build tool needs it", () => {
    expect(manifest.peerDependenciesMeta.esbuild).toEqual({ optional: true });
    expect(Object.keys(manifest.dependencies)).toEqual(["zod"]);
  });
});
