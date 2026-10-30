import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runSkill, type SkillCommand } from "../src/skill/cli.ts";

let scratch = "";
let context: SkillCommand;
let said: string[] = [];
let errors: string[] = [];
const installed = (path: string) =>
  join(scratch, "project/.claude/skills/build-a-game", path);

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "skill-cli-"));
  await mkdir(join(scratch, "project"), { recursive: true });
  await mkdir(join(scratch, "shipped"), { recursive: true });
  await writeFile(join(scratch, "shipped/SKILL.md"), "skill\n");
  context = {
    command: "skill-cmd",
    cwd: scratch,
    source: {
      directory: join(scratch, "shipped"),
      sdk: "@acme/sdk",
      version: "1.0.0",
    },
  };
  said = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation(
    (text: string) => void said.push(text),
  );
  vi.spyOn(console, "error").mockImplementation(
    (text: string) => void errors.push(text),
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(scratch, { force: true, recursive: true });
});

const run = (...args: string[]) =>
  runSkill([...args, "--dir", "project"], context);

describe("the skill command", () => {
  it("says how to use it for no command, an unknown one, or two", async () => {
    for (const args of [[], ["bogus"], ["install", "doctor"]]) {
      errors = [];
      expect((await runSkill(args, context)).code).toBe(2);
      expect(errors.join("\n")).toContain(
        "Usage: skill-cmd <doctor|install|update>",
      );
    }
  });

  it("says how to use it for an option it does not know", async () => {
    expect((await runSkill(["install", "--bogus"], context)).code).toBe(2);
    expect(errors.join("\n")).toContain("Usage: skill-cmd");
  });

  it("installs, then reports a second install as already current", async () => {
    expect((await run("install")).code).toBe(0);
    expect(said.at(-1)).toBe("Skill build-a-game installed (1 files).");
    expect(await readFile(installed("SKILL.md"), "utf8")).toBe("skill\n");
    expect((await run("install")).code).toBe(0);
    expect(said.at(-1)).toBe("Skill build-a-game is already current.");
  });

  it("works on the folder it is run in when it is given no --dir", async () => {
    await runSkill(["install"], { ...context, cwd: join(scratch, "project") });
    expect(await readFile(installed("SKILL.md"), "utf8")).toBe("skill\n");
  });

  it("does not touch AGENTS.md with --no-agents, and doctor then says it is not pointed at", async () => {
    await run("install", "--no-agents");
    await expect(
      readFile(join(scratch, "project/AGENTS.md"), "utf8"),
    ).rejects.toThrow();
    expect((await run("doctor")).code).toBe(1);
    expect(said.at(-1)).toContain("AGENTS.md does not point at it");
  });

  it("doctor is quiet success on a current copy, and fails on a missing one", async () => {
    expect((await run("doctor")).code).toBe(1);
    expect(said.at(-1)).toBe(
      "Skill build-a-game is not installed. Run the install command.",
    );
    await run("install");
    expect((await run("doctor")).code).toBe(0);
    expect(said.at(-1)).toBe("Skill build-a-game matches @acme/sdk 1.0.0.");
  });

  it("doctor names an outdated copy and a locally edited one", async () => {
    await run("install");
    await writeFile(join(scratch, "shipped/SKILL.md"), "newer\n");
    context = { ...context, source: { ...context.source, version: "2.0.0" } };
    expect((await run("doctor")).code).toBe(1);
    expect(said.at(-1)).toBe(
      "Skill build-a-game is 1.0.0 but @acme/sdk ships 2.0.0. Run update.",
    );
    await run("update");
    await writeFile(installed("SKILL.md"), "edited\n");
    expect((await run("doctor")).code).toBe(1);
    expect(said.at(-1)).toContain("local edits in: SKILL.md");
  });

  it("update refuses to replace edits, exits 1 saying so, and replaces them with --force", async () => {
    await run("install");
    await writeFile(installed("SKILL.md"), "edited\n");
    expect((await run("update")).code).toBe(1);
    expect(said.at(-1)).toContain(
      "Not replaced: these installed files were edited here: SKILL.md",
    );
    expect((await run("update", "--force")).code).toBe(0);
    expect(said.at(-1)).toBe("Skill build-a-game updated (1 files).");
    expect(await readFile(installed("SKILL.md"), "utf8")).toBe("skill\n");
  });

  it("installs from another folder with --from", async () => {
    await mkdir(join(scratch, "other"), { recursive: true });
    await writeFile(join(scratch, "other/SKILL.md"), "other\n");
    await run("install", "--from", "other");
    expect(await readFile(installed("SKILL.md"), "utf8")).toBe("other\n");
  });
});
