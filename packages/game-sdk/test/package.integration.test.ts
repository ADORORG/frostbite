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
    const built = new Set(await readdir(out, { recursive: true }));
    for (const [, target] of entries) {
      if (typeof target === "string") {
        // A stylesheet is not compiled: the build script copies it from the same place in `src`.
        const source = target.replace("./dist/", "src/");
        await readFile(join(root, source), "utf8");
        expect(manifest.scripts["build:package"]).toContain(source);
        continue;
      }
      expect(built.has(target.default.replace("./dist/", ""))).toBe(true);
      expect(built.has(target.types.replace("./dist/", ""))).toBe(true);
    }
  });

  it("imports only its own files, node's, and what it declares as dependencies", async () => {
    const allowed = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
    ]);
    for (const file of (await readdir(out, { recursive: true })).filter(
      (name) => name.endsWith(".js"),
    )) {
      const source = await readFile(join(out, file), "utf8");
      for (const [, specifier] of source.matchAll(/from "([^"]+)"/gu)) {
        if (specifier === undefined) continue;
        if (specifier.startsWith("./") || specifier.startsWith("../")) {
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

  it("gives the command that opens the local test page, built where the package says", async () => {
    expect(manifest.bin).toEqual({
      "frostbite-game-dev": "./dist/dev-host/bin.js",
      "frostbite-game-skill": "./dist/skill/bin.js",
    });
    const built = new Set(await readdir(out, { recursive: true }));
    expect(built.has("dev-host/bin.js")).toBe(true);
    expect(built.has("dev-host/client.js")).toBe(true);
    expect(
      (await readFile(join(out, "dev-host/bin.js"), "utf8")).startsWith(
        "#!/usr/bin/env node\n",
      ),
    ).toBe(true);
  });

  it("gives the command that installs the skill, and copies the skill in beside it when the package is built", async () => {
    expect(
      (await readFile(join(out, "skill/bin.js"), "utf8")).startsWith(
        "#!/usr/bin/env node\n",
      ),
    ).toBe(true);
    // The skill's source is a folder of the repository; the build copies it to where the command looks for it (`skill/files`).
    expect(manifest.scripts["build:package"]).toContain(
      "cpSync('../../skills/build-a-game','dist/skill/files'",
    );
    await readFile(join(root, "../../skills/build-a-game/SKILL.md"), "utf8");
  });

  it("keeps esbuild optional, because only the build tool and the test page need it", () => {
    expect(manifest.peerDependenciesMeta.esbuild).toEqual({ optional: true });
    expect(Object.keys(manifest.dependencies)).toEqual(["zod"]);
  });
});
