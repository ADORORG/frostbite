import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { access } from "node:fs/promises";

import { legacyDirectories, listSourceFiles } from "../src/files.ts";

let root = "";
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "policy-files-"));
});
afterEach(async () => rm(root, { force: true, recursive: true }));

async function put(path: string) {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), "x");
}

describe("the source files the policies read", () => {
  it("skips the games built into the web app's public folder, and only that folder", async () => {
    await put("apps/web/public/play/a/main.js");
    await put("apps/web/public/other/main.js");
    await put("packages/x/play/main.js");
    await put("games/a/src/main.ts");
    const listed = (await listSourceFiles(root)).map((file) =>
      relative(root, file),
    );
    expect(listed).toEqual([
      "apps/web/public/other/main.js",
      "games/a/src/main.ts",
      "packages/x/play/main.js",
    ]);
  });

  it("skips build output and dependencies, and lists only source extensions", async () => {
    await put("node_modules/p/index.js");
    await put(".next/x.js");
    await put("src/a.ts");
    await put("src/a.md");
    expect(
      (await listSourceFiles(root)).map((file) => relative(root, file)),
    ).toEqual(["src/a.ts"]);
  });

  it("skips a legacy folder and only that one", async () => {
    await put("games/frostbite/src/legacy/app.js");
    await put("games/frostbite/src/main.ts");
    await put("games/other/src/legacy/app.js");
    expect(
      (await listSourceFiles(root)).map((file) => relative(root, file)),
    ).toEqual(["games/frostbite/src/main.ts", "games/other/src/legacy/app.js"]);
  });

  it("holds every legacy folder to its README: what was changed and the plan to refactor it", async () => {
    const repository = join(import.meta.dirname, "../../..");
    for (const directory of legacyDirectories)
      await expect(
        access(join(repository, directory, "README.md")),
        directory,
      ).resolves.toBeUndefined();
  });
});
