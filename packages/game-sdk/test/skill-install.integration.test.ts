import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { byName, digestOf, listFiles } from "../src/skill/files.ts";
import {
  agentsFile,
  installSkill,
  markerFile,
  skillName,
  skillState,
  type SkillSource,
} from "../src/skill/install.ts";

let scratch = "";
let project = "";
let from = "";
const source = (version = "1.0.0"): SkillSource => ({
  directory: from,
  sdk: "@acme/sdk",
  version,
});
const installedFile = (path: string) =>
  join(project, ".claude/skills", skillName, path);
const put = async (path: string, text: string) => {
  await mkdir(join(from, path, ".."), { recursive: true });
  await writeFile(join(from, path), text);
};
const install = (
  options: { agents?: boolean; force?: boolean } = {},
  version = "1.0.0",
) =>
  installSkill({
    agents: options.agents ?? true,
    force: options.force ?? false,
    project,
    source: source(version),
  });

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "skill-install-"));
  project = join(scratch, "project");
  from = join(scratch, "shipped");
  await mkdir(project, { recursive: true });
  await put("SKILL.md", "---\nname: build-a-game\n---\nRead the references.\n");
  await put("references/rules.md", "one\n");
});
afterEach(async () => rm(scratch, { force: true, recursive: true }));

describe("listing and hashing a skill", () => {
  it("lists plain files in a fixed order, with folders as path prefixes", async () => {
    await put("references/a.md", "a");
    expect(await listFiles(from)).toEqual([
      "SKILL.md",
      "references/a.md",
      "references/rules.md",
    ]);
  });

  it("skips anything that is not a plain file or folder", async () => {
    await symlink(join(from, "SKILL.md"), join(from, "link.md"));
    expect(await listFiles(from)).toEqual(["SKILL.md", "references/rules.md"]);
  });

  it("orders names by code unit, so capitals come first on every machine", () => {
    expect(byName("SKILL.md", "references")).toBeLessThan(0);
    expect(byName("references", "SKILL.md")).toBeGreaterThan(0);
    expect(byName("a", "a")).toBe(0);
  });

  it("hashes bytes with SHA-256", () => {
    expect(digestOf(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("installing the skill", () => {
  it("copies every file, records what it copied, and points AGENTS.md at it", async () => {
    expect(await install()).toEqual({ files: 2, kind: "installed" });
    expect(await readFile(installedFile("references/rules.md"), "utf8")).toBe(
      "one\n",
    );
    const marker = JSON.parse(
      await readFile(installedFile(markerFile), "utf8"),
    );
    expect(marker.version).toBe("1.0.0");
    expect(Object.keys(marker.files)).toEqual([
      "SKILL.md",
      "references/rules.md",
    ]);
    const agents = await readFile(join(project, agentsFile), "utf8");
    expect(agents).toContain("`@acme/sdk`");
    expect(agents).toContain(".claude/skills/build-a-game/SKILL.md");
  });

  it("leaves AGENTS.md alone when it is asked not to write it", async () => {
    await install({ agents: false });
    await expect(readFile(join(project, agentsFile), "utf8")).rejects.toThrow();
  });

  it("keeps what the project wrote in AGENTS.md", async () => {
    await writeFile(join(project, agentsFile), "# Mine\n");
    await install();
    expect(await readFile(join(project, agentsFile), "utf8")).toMatch(
      /^# Mine\n\n<!--/,
    );
  });

  it("changes nothing when it is run again on a current copy", async () => {
    await install();
    expect(await install()).toEqual({ kind: "unchanged" });
  });

  it("refuses a folder that is not a skill, and writes nothing", async () => {
    await rm(join(from, "SKILL.md"));
    await expect(install()).rejects.toThrow("has no SKILL.md");
    await expect(skillState(project, source())).resolves.toEqual({
      kind: "missing",
    });
  });
});

describe("telling whether the copy is current", () => {
  it("is missing before an install and when the marker cannot be read", async () => {
    expect(await skillState(project, source())).toEqual({ kind: "missing" });
    await install();
    await writeFile(installedFile(markerFile), "{not json");
    expect(await skillState(project, source())).toEqual({ kind: "missing" });
    await writeFile(installedFile(markerFile), '{"sdk":1}');
    expect(await skillState(project, source())).toEqual({ kind: "missing" });
  });

  it("is current, and says whether AGENTS.md points at it", async () => {
    await install();
    expect(await skillState(project, source())).toEqual({
      agents: true,
      kind: "current",
    });
    await rm(join(project, agentsFile));
    expect(await skillState(project, source())).toEqual({
      agents: false,
      kind: "current",
    });
    await writeFile(join(project, agentsFile), "# no pointer\n");
    expect(await skillState(project, source())).toEqual({
      agents: false,
      kind: "current",
    });
  });

  it("is outdated when the SDK ships a changed file, naming both versions", async () => {
    await install();
    await put("references/rules.md", "two\n");
    expect(await skillState(project, source("2.0.0"))).toEqual({
      installed: "1.0.0",
      kind: "outdated",
      shipped: "2.0.0",
    });
  });

  it("is outdated when the SDK ships an extra file or drops one", async () => {
    await install();
    await put("references/new.md", "n");
    expect((await skillState(project, source("2.0.0"))).kind).toBe("outdated");
    await rm(join(from, "references/new.md"));
    await rm(join(from, "references/rules.md"));
    expect((await skillState(project, source("2.0.0"))).kind).toBe("outdated");
  });

  it("is modified, naming the files, when an installed file was edited, added or removed", async () => {
    await install();
    await writeFile(installedFile("references/rules.md"), "mine\n");
    await writeFile(installedFile("extra.md"), "x");
    await rm(installedFile("SKILL.md"));
    expect(await skillState(project, source())).toEqual({
      files: ["SKILL.md", "extra.md", "references/rules.md"],
      kind: "modified",
    });
  });
});

describe("updating the skill", () => {
  it("replaces a stale copy, drops files the SDK no longer ships, and keeps the marker current", async () => {
    await install();
    await put("references/rules.md", "two\n");
    await rm(join(from, "SKILL.md"));
    await put("SKILL.md", "---\nname: build-a-game\n---\nNew.\n");
    await put("references/added.md", "a");
    expect(await install({}, "2.0.0")).toEqual({ files: 3, kind: "updated" });
    expect(await readFile(installedFile("references/rules.md"), "utf8")).toBe(
      "two\n",
    );
    expect(await skillState(project, source("2.0.0"))).toEqual({
      agents: true,
      kind: "current",
    });
    await rm(join(from, "references/added.md"));
    await install({}, "3.0.0");
    await expect(
      readFile(installedFile("references/added.md"), "utf8"),
    ).rejects.toThrow();
  });

  it("keeps a copy someone edited, and says which files, unless it is forced", async () => {
    await install();
    await writeFile(installedFile("references/rules.md"), "mine\n");
    expect(await install()).toEqual({
      files: ["references/rules.md"],
      kind: "kept",
    });
    expect(await readFile(installedFile("references/rules.md"), "utf8")).toBe(
      "mine\n",
    );
    expect(await install({ force: true })).toEqual({
      files: 2,
      kind: "updated",
    });
    expect(await readFile(installedFile("references/rules.md"), "utf8")).toBe(
      "one\n",
    );
  });
});
