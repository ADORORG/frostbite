import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import manifest from "../package.json" with { type: "json" };

const bin = join(import.meta.dirname, "../src/skill/bin.ts");
const shipped = join(import.meta.dirname, "../../../skills/build-a-game");
let scratch = "";
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "skill-bin-"));
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

const command = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      bin,
      ...args,
      "--dir",
      scratch,
      "--from",
      shipped,
    ],
    { encoding: "utf8" },
  );

// Runs the command as a process on the real skill folder of this repository: what a builder runs, apart from where the files come from.
describe("the skill command as a process", () => {
  it("installs the repository's skill, names this SDK in AGENTS.md, and then finds the copy current", async () => {
    const installed = command("install");
    expect(installed.status).toBe(0);
    expect(installed.stdout).toContain("Skill build-a-game installed");
    expect(
      await readFile(
        join(scratch, ".claude/skills/build-a-game/SKILL.md"),
        "utf8",
      ),
    ).toContain("name: build-a-game");
    expect(await readFile(join(scratch, "AGENTS.md"), "utf8")).toContain(
      `\`${manifest.name}\``,
    );
    const doctor = command("doctor");
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      `matches ${manifest.name} ${manifest.version}`,
    );
  });

  it("exits with its usage for an unknown command", () => {
    const result = command("bogus");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage: bin.ts <doctor|install|update>");
  });
});
