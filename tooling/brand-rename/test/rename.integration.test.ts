import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findRemaining, runRename } from "../src/rename.ts";

const brand = {
  display: "Frostbite",
  scope: "@frostbite",
  slug: "frostbite",
} as const;

// A small repository with one file of each kind a rename meets: code, docs, a configuration file with a name that must stay, generated and
// historical files that must not be touched, an image, and a file with a form the rules do not rewrite.
const files: Record<string, string | Buffer> = {
  "README.md": "# Ador\n\nThe Ador arcade.\n",
  "deploy/compose.yml":
    "image: ghcr.io/adororg/frostbite:dev\nvolume: ador-stack-postgres-data\n",
  "logo.png": Buffer.from([0x89, 0x50, 0x00, 0x61, 0x64, 0x6f, 0x72]),
  "notes/odd.txt": "see a/path/ador/segment\n",
  "packages/database/migrations/1_a/migration.sql": 'create schema "ador";\n',
  "packages/database/migrations/1_a/snapshot.json": '{"schema":"ador"}\n',
  "pnpm-lock.yaml": "'@ador/shared': workspace\n",
  "src/a.ts":
    'import { x } from "@ador/shared/chain";\nconst key = "ador:game:g:progress";\n',
  "tooling/brand-rename/src/own.ts": 'export const old = "@ador";\n',
};

let root = "";
const read = (file: string) => readFile(join(root, file), "utf8");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "brand-rename-"));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
});
afterEach(() => rm(root, { force: true, recursive: true }));

describe("renaming a repository", () => {
  it("says what it would change in a dry run, and writes nothing", async () => {
    const report = await runRename({ brand, dryRun: true, root });
    expect([...report.changed].sort()).toEqual([
      "README.md",
      "deploy/compose.yml",
      "src/a.ts",
    ]);
    expect(report.counts).toMatchObject({
      "display name": 2,
      "hyphenated names": 1,
      "package scope": 1,
      "storage keys": 1,
    });
    expect(await read("README.md")).toBe(files["README.md"]);
    expect(await read("src/a.ts")).toBe(files["src/a.ts"]);
  });

  it("rewrites the files it should and leaves the rest as they were", async () => {
    const report = await runRename({ brand, dryRun: false, root });
    expect(await read("README.md")).toBe(
      "# Frostbite\n\nThe Frostbite arcade.\n",
    );
    expect(await read("src/a.ts")).toBe(
      'import { x } from "@frostbite/shared/chain";\nconst key = "frostbite:game:g:progress";\n',
    );
    // The GitHub organisation in the image address stays; the volume name does not.
    expect(await read("deploy/compose.yml")).toBe(
      "image: ghcr.io/adororg/frostbite:dev\nvolume: frostbite-stack-postgres-data\n",
    );
    for (const untouched of [
      "packages/database/migrations/1_a/migration.sql",
      "packages/database/migrations/1_a/snapshot.json",
      "pnpm-lock.yaml",
      "tooling/brand-rename/src/own.ts",
      "notes/odd.txt",
    ])
      expect(await read(untouched)).toBe(files[untouched]);
    expect(await readFile(join(root, "logo.png"))).toEqual(files["logo.png"]);
    expect(report.excluded).toBe(4);
    expect(report.binary).toBe(1);
  });

  it("reports a form it does not know how to rewrite, instead of hiding it", async () => {
    const report = await runRename({ brand, dryRun: false, root });
    expect(report.remaining).toEqual([
      { file: "notes/odd.txt", line: 1, text: "see a/path/ador/segment" },
    ]);
  });

  it("changes nothing the second time", async () => {
    await runRename({ brand, dryRun: false, root });
    const again = await runRename({ brand, dryRun: false, root });
    expect(again.changed).toEqual([]);
    expect(again.counts).toEqual({});
  });

  it("finds the old name in a repository that has not been renamed, and only the odd form after", async () => {
    const before = await findRemaining({ root });
    expect([...new Set(before.map(({ file }) => file))].sort()).toEqual([
      "README.md",
      "deploy/compose.yml",
      "notes/odd.txt",
      "src/a.ts",
    ]);
    await runRename({ brand, dryRun: false, root });
    expect((await findRemaining({ root })).map(({ file }) => file)).toEqual([
      "notes/odd.txt",
    ]);
  });

  it("refuses a new name that contains the old one, before it touches anything", async () => {
    await expect(
      runRename({
        brand: { display: "Adorable", scope: "@adorable", slug: "adorable" },
        dryRun: false,
        root,
      }),
    ).rejects.toThrow("old name");
    expect(await read("README.md")).toBe(files["README.md"]);
  });

  it("works on a list of files it is given, not only on what git tracks", async () => {
    const report = await runRename({
      brand,
      dryRun: true,
      files: ["README.md"],
      root,
    });
    expect(report.changed).toEqual(["README.md"]);
  });
});
