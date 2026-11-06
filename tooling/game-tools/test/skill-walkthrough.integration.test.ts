import { readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scaffoldGame } from "../src/scaffold.ts";
import {
  makeScaffoldWorkspace,
  type ScaffoldWorkspace,
} from "./support/scaffold-workspace.ts";

// The build-a-game skill tells an agent what `pnpm game:new` leaves behind and what it does not. The skill's path check cannot see
// whether those sentences are still true, so they are checked here against a real scaffold.
const skill = join(
  import.meta.dirname,
  "../../../skills/build-a-game/SKILL.md",
);
const id = "river-run";
let workspace: ScaffoldWorkspace | undefined;

beforeEach(async () => {
  workspace = await makeScaffoldWorkspace();
});
afterEach(async () => {
  if (workspace !== undefined)
    await rm(workspace.root, { force: true, recursive: true });
});

async function files(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else found.push(path);
  }
  return found;
}

// The text of one numbered step of the skill, up to the next step.
async function step(number: number): Promise<string> {
  const text = await readFile(skill, "utf8");
  const start = text.indexOf(`\n${String(number)}. `);
  const end = text.indexOf(`\n${String(number + 1)}. `, start + 1);
  if (start < 0 || end < 0) throw new Error(`Step ${String(number)} not found`);
  return text.slice(start, end);
}

const repositoryPaths =
  /`((?:apps|configs|games|packages|tests|tooling)\/[^`\s]+)`/gu;
const pathsIn = (text: string, pattern: RegExp = repositoryPaths) =>
  [...text.matchAll(pattern)].map(([, path]) =>
    (path ?? "").replace("<id>", id),
  );

describe("the build-a-game skill and a freshly scaffolded game", () => {
  it("registers a game in exactly the places the skill names", async () => {
    if (workspace === undefined) throw new Error("No workspace");
    const { root, paths } = workspace;
    const before = new Map<string, string>();
    for (const file of await files(join(root, "configs")))
      before.set(file, await readFile(file, "utf8"));
    await scaffoldGame({ id, paths });
    const changed: string[] = [];
    for (const file of await files(join(root, "configs"))) {
      if (before.get(file) !== (await readFile(file, "utf8")))
        changed.push(relative(root, file));
    }
    // Step 6 names every file a builder registers a game in: if it names one game:new does not write, the builder is told to edit
    // something by hand that nothing checks.
    expect(changed.sort()).toEqual(pathsIn(await step(6)).sort());
  });

  it("leaves the files the skill says a new game has, and a verifier whose digest is already pinned", async () => {
    if (workspace === undefined) throw new Error("No workspace");
    const { root, paths } = workspace;
    await scaffoldGame({ id, paths });
    const folder = join(root, "games", id);
    const made = (await files(folder)).map((file) => relative(folder, file));
    const named = pathsIn(await step(3), /`((?:src|test)\/[^`\s]+)`/gu);
    expect(named.length).toBeGreaterThan(3);
    for (const path of named)
      expect(made.some((file) => file.startsWith(path))).toBe(true);
    expect(made).toContain("src/replay.ts");
    const manifest = await readFile(
      join(root, `configs/games/${id}.ts`),
      "utf8",
    );
    expect(manifest).not.toContain("0".repeat(64));
    expect(manifest).toMatch(/sha256:\s*"[0-9a-f]{64}"/u);
  });
});
