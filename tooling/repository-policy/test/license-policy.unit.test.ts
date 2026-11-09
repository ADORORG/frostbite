import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findLicenseViolations,
  repositoryLicense,
} from "../src/license-policy.ts";
import type { Workspace } from "../src/workspaces.ts";

const { holder, spdx, title, year } = repositoryLicense;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

const licenseText = `# ${title}\n\n## Notice\n\nCopyright ${String(year)} ${holder}\n`;
const clean: Record<string, string> = {
  LICENSE: licenseText,
  NOTICE: "Artwork and the name: All Rights Reserved.\n",
  "README.md": `Licensed under ${spdx}.\n`,
  "deploy/Dockerfile": `LABEL org.opencontainers.image.licenses="${spdx}"\n`,
  "package.json": JSON.stringify({ license: spdx }),
  "packages/one/package.json": JSON.stringify({ license: spdx, name: "one" }),
};

// A repository that says its licence everywhere it should, with `changes` laid over it (a null removes a file).
async function repository(changes: Record<string, string | null> = {}) {
  const root = await mkdtemp(join(tmpdir(), "license-policy-"));
  roots.push(root);
  for (const [path, contents] of Object.entries({ ...clean, ...changes })) {
    if (contents === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents, "utf8");
  }
  const workspaces: Workspace[] = [
    { directory: join(root, "packages/one"), name: "one", scripts: {} },
  ];
  return { root, workspaces };
}
const violations = async (changes: Record<string, string | null>) => {
  const { root, workspaces } = await repository(changes);
  return findLicenseViolations(root, workspaces);
};

describe("the licence policy", () => {
  it("accepts a repository that says its licence everywhere", async () => {
    expect(await violations({})).toEqual([]);
  });

  it("wants the licence text, for this holder and year, with nothing left to fill in", async () => {
    expect(await violations({ LICENSE: null })).toEqual([
      "LICENSE is missing.",
    ]);
    expect(await violations({ LICENSE: "MIT License\n" })).toEqual([
      `LICENSE is not the ${title}.`,
      `LICENSE does not name "Copyright ${String(year)} ${holder}".`,
    ]);
    expect(
      await violations({
        LICENSE: licenseText.replace(holder, "Someone Else"),
      }),
    ).toEqual([`LICENSE does not name "Copyright ${String(year)} ${holder}".`]);
    expect(
      await violations({ LICENSE: `${licenseText}\nCopyright \${year}\n` }),
    ).toEqual(["LICENSE still has a placeholder to fill in."]);
  });

  it("wants a NOTICE that reserves what the licence does not grant", async () => {
    expect(await violations({ NOTICE: null })).toEqual(["NOTICE is missing."]);
    expect(await violations({ NOTICE: "Thanks to everyone.\n" })).toEqual([
      "NOTICE does not reserve the rights the licence does not grant.",
    ]);
  });

  it("wants the root and every workspace to declare the licence, and names the one that does not", async () => {
    expect(
      await violations({ "package.json": JSON.stringify({ license: "MIT" }) }),
    ).toEqual([`the root package.json declares license "MIT", not "${spdx}".`]);
    expect(
      await violations({
        "packages/one/package.json": JSON.stringify({ name: "one" }),
      }),
    ).toEqual([
      `one's package.json declares license undefined, not "${spdx}".`,
    ]);
    expect(
      await violations({
        "packages/one/package.json": JSON.stringify({
          license: "UNLICENSED",
          name: "one",
        }),
      }),
    ).toEqual([
      `one's package.json declares license "UNLICENSED", not "${spdx}".`,
    ]);
    expect(
      await violations({ "packages/one/package.json": "{ not json" }),
    ).toEqual([
      `one's package.json declares license undefined, not "${spdx}".`,
    ]);
  });

  it("wants the README and the image label to name the licence", async () => {
    expect(await violations({ "README.md": "No licence here.\n" })).toEqual([
      `README.md does not name the licence (${spdx}).`,
    ]);
    expect(await violations({ "README.md": null })).toEqual([
      `README.md does not name the licence (${spdx}).`,
    ]);
    const label = `deploy/Dockerfile does not label the image with org.opencontainers.image.licenses="${spdx}".`;
    expect(await violations({ "deploy/Dockerfile": "FROM node\n" })).toEqual([
      label,
    ]);
    expect(await violations({ "deploy/Dockerfile": null })).toEqual([label]);
    // A label that names another licence is as wrong as none.
    expect(
      await violations({
        "deploy/Dockerfile": 'LABEL org.opencontainers.image.licenses="MIT"\n',
      }),
    ).toEqual([label]);
  });
});
