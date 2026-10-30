import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findSkillViolations,
  maximumDescription,
  maximumSkillLines,
} from "../src/skill-policy.ts";

let root = "";
const put = async (path: string, text: string) => {
  await mkdir(dirname(resolve(root, path)), { recursive: true });
  await writeFile(resolve(root, path), text, "utf8");
};
const skill = (
  fields = "name: demo\ndescription: Does a thing.",
  body = "Read references/one.md.\n",
) => `---\n${fields}\n---\n${body}`;

beforeEach(async () => {
  root = await mkdtemp(resolve(tmpdir(), "skill-policy-"));
  await put("packages/game-sdk/package.json", '{"name":"@acme/game-sdk"}');
  await put("package.json", '{"scripts":{"game:new":"x","typecheck":"y"}}');
  await put("games/demo/index.html", "<html></html>");
  await put("skills/demo/SKILL.md", skill());
  await put("skills/demo/references/one.md", "Plain text.\n");
});
afterEach(async () => rm(root, { force: true, recursive: true }));

describe("the skill policy", () => {
  it("accepts a skill whose parts all agree", async () => {
    await put(
      "skills/demo/references/one.md",
      "Run `pnpm game:new <id>` then `pnpm install`, and open `games/demo/index.html`.\n",
    );
    expect(await findSkillViolations(root)).toEqual([]);
  });

  it("has nothing to say when the repository ships no skills", async () => {
    await rm(resolve(root, "skills"), { recursive: true });
    expect(await findSkillViolations(root)).toEqual([]);
  });

  it("ignores a plain file beside the skills' folders", async () => {
    await put("skills/README.md", "About the skills.\n");
    expect(await findSkillViolations(root)).toEqual([]);
  });

  it("requires a SKILL.md", async () => {
    await rm(resolve(root, "skills/demo/SKILL.md"));
    expect(await findSkillViolations(root)).toEqual([
      "skills/demo has no SKILL.md.",
    ]);
  });

  it("requires the name in the front matter to be the folder's", async () => {
    await put("skills/demo/SKILL.md", skill("name: other\ndescription: d"));
    expect(await findSkillViolations(root)).toEqual([
      'skills/demo/SKILL.md names itself "other", not "demo".',
    ]);
    await put("skills/demo/SKILL.md", "no front matter\nreferences/one.md\n");
    expect(await findSkillViolations(root)).toContain(
      'skills/demo/SKILL.md names itself "", not "demo".',
    );
  });

  it("requires a description that is neither empty nor too long, and accepts the longest allowed", async () => {
    const need =
      "skills/demo/SKILL.md needs a description of 1 to 1024 characters.";
    await put("skills/demo/SKILL.md", skill("name: demo"));
    expect(await findSkillViolations(root)).toEqual([need]);
    await put(
      "skills/demo/SKILL.md",
      skill(`name: demo\ndescription: ${"d".repeat(maximumDescription + 1)}`),
    );
    expect(await findSkillViolations(root)).toEqual([need]);
    await put(
      "skills/demo/SKILL.md",
      skill(`name: demo\ndescription: ${"d".repeat(maximumDescription)}`),
    );
    expect(await findSkillViolations(root)).toEqual([]);
  });

  it("limits SKILL.md's length, and accepts exactly the limit", async () => {
    const head = skill();
    const lines = (count: number) =>
      head + "\n".repeat(count - head.split("\n").length);
    await put("skills/demo/SKILL.md", lines(maximumSkillLines));
    expect(await findSkillViolations(root)).toEqual([]);
    await put("skills/demo/SKILL.md", lines(maximumSkillLines + 1));
    expect(await findSkillViolations(root)).toEqual([
      "skills/demo/SKILL.md is over 500 lines; move detail into references/.",
    ]);
  });

  it("requires every linked reference to exist and every reference to be linked", async () => {
    await put(
      "skills/demo/SKILL.md",
      skill(undefined, "references/one.md and references/gone.md\n"),
    );
    await put("skills/demo/references/orphan.md", "x\n");
    expect(await findSkillViolations(root)).toEqual([
      "skills/demo/SKILL.md links references/gone.md, which does not exist.",
      "skills/demo/references/orphan.md is not linked from SKILL.md.",
    ]);
  });

  it("finds references in folders below references/", async () => {
    await put("skills/demo/SKILL.md", skill(undefined, "references/one.md\n"));
    await put("skills/demo/references/deep/two.md", "x\n");
    expect(await findSkillViolations(root)).toEqual([
      "skills/demo/references/deep/two.md is not linked from SKILL.md.",
    ]);
  });

  it("requires the repository paths a file names to exist", async () => {
    await put(
      "skills/demo/references/one.md",
      "See `games/demo/index.html` and `games/missing/src/a.ts`.\n",
    );
    expect(await findSkillViolations(root)).toEqual([
      "skills/demo/references/one.md names games/missing/src/a.ts, which does not exist.",
    ]);
  });

  it("does not look for a path that has a placeholder in it", async () => {
    await put(
      "skills/demo/references/one.md",
      "Write `configs/games/<id>.ts` for your game.\n",
    );
    expect(await findSkillViolations(root)).toEqual([]);
  });

  it("requires the root scripts a file runs to exist, and lets pnpm's own commands through", async () => {
    await put(
      "skills/demo/references/one.md",
      "`pnpm typecheck`, `pnpm --filter x test`, `pnpm add y`, `pnpm exec z`, `pnpm game:gone <id>`.\n",
    );
    expect(await findSkillViolations(root)).toEqual([
      'skills/demo/references/one.md runs "pnpm game:gone", which is not a root script.',
    ]);
  });

  it("refuses a file that names the platform, in any case, in SKILL.md or a reference", async () => {
    await put(
      "skills/demo/SKILL.md",
      skill(undefined, "references/one.md uses @Acme/x\n"),
    );
    await put("skills/demo/references/one.md", "the acme SDK\n");
    expect(await findSkillViolations(root)).toEqual([
      'skills/demo/SKILL.md names the platform ("acme"); say <sdk> and look the name up.',
      'skills/demo/references/one.md names the platform ("acme"); say <sdk> and look the name up.',
    ]);
  });

  it("does not look for a platform name when the SDK has no scope", async () => {
    await put("packages/game-sdk/package.json", '{"name":"game-sdk"}');
    await put("skills/demo/references/one.md", "game-sdk is fine here\n");
    expect(await findSkillViolations(root)).toEqual([]);
  });
});
