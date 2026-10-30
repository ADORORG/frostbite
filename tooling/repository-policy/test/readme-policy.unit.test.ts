import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findReadmeViolations,
  minimumReadmeLines,
} from "../src/readme-policy.ts";
import type { Workspace } from "../src/workspaces.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function workspaceWith(readme: string | null): Promise<Workspace> {
  const directory = await mkdtemp(resolve(tmpdir(), "readme-policy-"));
  roots.push(directory);
  await mkdir(directory, { recursive: true });
  if (readme !== null)
    await writeFile(resolve(directory, "README.md"), readme, "utf8");
  return { directory, name: "pkg", scripts: {} };
}

const filler = "A line about what it does.\n".repeat(minimumReadmeLines);
const complete = `# pkg\n\n${filler}\n## Tests\n\nRun test:unit.\n\n## Ownership\n\nPlatform engineering.\n`;

describe("the README policy", () => {
  it("accepts a README that explains itself, says how to test, and names an owner", async () => {
    expect(await findReadmeViolations([await workspaceWith(complete)])).toEqual(
      [],
    );
  });

  it("accepts the other spellings of the ownership heading", async () => {
    for (const heading of [
      "## Operational ownership",
      "### Owner",
      "## Ownership",
    ])
      expect(
        await findReadmeViolations([
          await workspaceWith(complete.replace("## Ownership", heading)),
        ]),
      ).toEqual([]);
  });

  it("rejects a workspace with no README", async () => {
    expect(await findReadmeViolations([await workspaceWith(null)])).toEqual([
      "pkg has no README.md.",
    ]);
  });

  it("rejects a stub, one that does not say how to test, and one with no ownership section", async () => {
    expect(
      await findReadmeViolations([
        await workspaceWith("# pkg\n\nTests. Ownership.\n"),
      ]),
    ).toEqual([
      `pkg's README.md is under ${String(minimumReadmeLines)} lines.`,
      "pkg's README.md has no Ownership section.",
    ]);
    expect(
      await findReadmeViolations([
        await workspaceWith(
          complete.replace(/test/giu, "try").replace("## Tests", "## Trying"),
        ),
      ]),
    ).toEqual(["pkg's README.md does not say how to test it."]);
    expect(
      await findReadmeViolations([
        await workspaceWith(complete.replace("## Ownership", "## Who")),
      ]),
    ).toEqual(["pkg's README.md has no Ownership section."]);
  });

  it("counts a README of exactly the minimum length as long enough, and one line fewer as too short", async () => {
    const withLines = (count: number): string =>
      [
        "## Ownership",
        "test",
        ...Array.from({ length: count - 2 }, () => "text"),
      ].join("\n");
    expect(
      await findReadmeViolations([
        await workspaceWith(withLines(minimumReadmeLines)),
      ]),
    ).toEqual([]);
    expect(
      await findReadmeViolations([
        await workspaceWith(withLines(minimumReadmeLines - 1)),
      ]),
    ).toEqual([
      `pkg's README.md is under ${String(minimumReadmeLines)} lines.`,
    ]);
  });
});
