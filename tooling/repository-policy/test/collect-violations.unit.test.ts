import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { collectViolations } from "../src/collect-violations.ts";
import { repositoryLicense } from "../src/license-policy.ts";
import { maximumParentSegments } from "../src/import-policy.ts";
import { minimumReadmeLines } from "../src/readme-policy.ts";
import { requiredWorkspaceScripts } from "../src/script-policy.ts";
import { maximumSourceLines } from "../src/line-policy.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

// The one workspace of the repositories below. The skill policy reads the game SDK's package, so that is the workspace.
const workspace = "packages/game-sdk";
const packageName = "@fixture/game-sdk";
const sentence = "Write this sentence only one time.";

const readme = `# ${packageName}\n\n${"What it does.\n".repeat(minimumReadmeLines)}\n## Tests\n\nRun test:unit.\n\n## Ownership\n\nPlatform engineering.\n`;
const scripts = Object.fromEntries(
  requiredWorkspaceScripts.map((name) => [name, "vitest run"]),
);
const packageJson = (omit?: string) =>
  JSON.stringify({
    license: repositoryLicense.spdx,
    name: packageName,
    scripts: Object.fromEntries(
      Object.entries(scripts).filter(([name]) => name !== omit),
    ),
  });

type Files = Readonly<Record<string, string>>;

// A repository every policy accepts, with `changes` laid over it (a null removes a file). Returns where it is.
async function repository(changes: Record<string, string | null> = {}) {
  const root = await mkdtemp(join(tmpdir(), "collect-violations-"));
  roots.push(root);
  const files: Files = {
    ".github/workflows/ci.yml": `jobs:\n  upload:\n    path: ${workspace}/coverage\n`,
    "contracts/templates/release.json": "{}",
    LICENSE: `${repositoryLicense.title}\n\nCopyright ${String(repositoryLicense.year)} ${repositoryLicense.holder}\n`,
    NOTICE: "Artwork and the name: all rights reserved.\n",
    "README.md": `Licensed under ${repositoryLicense.spdx}.\n`,
    "deploy/Dockerfile": `LABEL org.opencontainers.image.licenses="${repositoryLicense.spdx}"\n`,
    "package.json": JSON.stringify({ license: repositoryLicense.spdx }),
    "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    [`${workspace}/README.md`]: readme,
    [`${workspace}/package.json`]: packageJson(),
    [`${workspace}/src/index.ts`]: "export const ready = true;\n",
    "tooling/repository-policy/sentence-baseline.json": "{}",
  };
  for (const [path, contents] of Object.entries({ ...files, ...changes })) {
    if (contents === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents, "utf8");
  }
  return root;
}

const copyOfTheSentence = (name: string) => ({
  [`${workspace}/src/${name}.ts`]: `export const ${name} = "${sentence}";\n`,
});

// Short, but it says how to test and names an owner, so the length is the only thing wrong with it.
const stubReadme = "Run test:unit.\n\n## Ownership\n";

// One way to break each policy, and the words that policy uses about it. Each is applied alone to the clean repository, so the one
// violation found says which policy ran.
const breakages: ReadonlyArray<
  readonly [string, Readonly<Record<string, string | null>>, string]
> = [
  [
    "the workspace script policy",
    { [`${workspace}/package.json`]: packageJson("test:unit") },
    `${packageName} is missing test:unit.`,
  ],
  [
    "the README policy",
    { [`${workspace}/README.md`]: stubReadme },
    `${packageName}'s README.md is under`,
  ],
  [
    "the skill policy",
    { "skills/broken/notes.md": "Nothing here." },
    "skills/broken has no SKILL.md.",
  ],
  [
    "the file length policy",
    {
      [`${workspace}/src/long.ts`]: "export {};\n".repeat(
        maximumSourceLines + 1,
      ),
    },
    `${workspace}/src/long.ts has ${String(maximumSourceLines + 1)} lines.`,
  ],
  [
    "the deep relative import policy",
    {
      [`${workspace}/src/deep.ts`]: `import "${"../".repeat(maximumParentSegments + 1)}elsewhere";\n`,
    },
    `${workspace}/src/deep.ts imports a file through three or more "../"`,
  ],
  [
    "the import boundary policy",
    {
      [`${workspace}/src/boundary.ts`]:
        'import { open } from "@frostbite/database";\nexport { open };\n',
    },
    `${workspace}/src/boundary.ts imports the database package root`,
  ],
  [
    "the duplicate sentence policy",
    { ...copyOfTheSentence("first"), ...copyOfTheSentence("second") },
    `"${sentence}" is written 2 times`,
  ],
  [
    "the template release policy",
    {
      "contracts/templates/release.json": JSON.stringify({
        rewards: { bytes: 1, sha256: "0" },
      }),
    },
    "contracts/templates/released/rewards.wasm is missing",
  ],
  ["the licence policy", { LICENSE: null }, "LICENSE is missing."],
  [
    "the coverage upload policy",
    { ".github/workflows/ci.yml": "jobs: {}\n" },
    `${packageName} writes its coverage to ${workspace}/coverage`,
  ],
];

describe("the repository check", () => {
  it("accepts a repository that breaks no policy, and counts what it read", async () => {
    const report = await collectViolations(await repository());

    expect(report.violations).toEqual([]);
    expect(report.workspaceCount).toBe(1);
    expect(report.fileCount).toBe(1);
  });

  it.each(breakages)("runs %s", async (_policy, changes, words) => {
    const { violations } = await collectViolations(await repository(changes));

    expect(violations).toEqual([expect.stringContaining(words)]);
  });

  it("reads the sentence baseline, so a recorded duplicate is allowed", async () => {
    const root = await repository({
      ...copyOfTheSentence("first"),
      ...copyOfTheSentence("second"),
      "tooling/repository-policy/sentence-baseline.json": JSON.stringify({
        [sentence]: 2,
      }),
    });

    expect((await collectViolations(root)).violations).toEqual([]);
  });

  it("reports the violations of several policies together", async () => {
    const root = await repository({
      [`${workspace}/README.md`]: stubReadme,
      ".github/workflows/ci.yml": "jobs: {}\n",
    });

    expect((await collectViolations(root)).violations).toHaveLength(2);
  });
});
