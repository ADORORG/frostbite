import { describe, expect, it } from "vitest";

import {
  blockEnd,
  blockStart,
  hasSkillBlock,
  skillBlock,
  withSkillBlock,
} from "../src/skill/agents-block.ts";

const block = skillBlock({ sdk: "@acme/sdk", skillPath: ".claude/s/SKILL.md" });

describe("the pointer written into AGENTS.md", () => {
  it("names the SDK and the skill it points at, between its two markers", () => {
    expect(block.startsWith(blockStart)).toBe(true);
    expect(block.endsWith(blockEnd)).toBe(true);
    expect(block).toContain("`@acme/sdk`");
    expect(block).toContain("`.claude/s/SKILL.md`");
  });

  it("is added after what the project already wrote, leaving that untouched", () => {
    const out = withSkillBlock("# Rules\n\nBe kind.\n\n\n", block);
    expect(out).toBe(`# Rules\n\nBe kind.\n\n${block}\n`);
  });

  it("is the whole file when the file was empty", () => {
    expect(withSkillBlock("", block)).toBe(`${block}\n`);
  });

  it("replaces an earlier copy of itself and nothing around it", () => {
    const older = skillBlock({ sdk: "@old/sdk", skillPath: "old" });
    const out = withSkillBlock(`before\n${older}\nafter\n`, block);
    expect(out).toBe(`before\n${block}\nafter\n`);
    expect(out).not.toContain("@old/sdk");
  });

  it("is not mangled by a replacement that looks like a replacement pattern", () => {
    const odd = `${blockStart}\n$& $1 $$\n${blockEnd}`;
    expect(withSkillBlock(`x\n${block}\n`, odd)).toContain("$& $1 $$");
  });

  it("is found only when both markers are there", () => {
    expect(hasSkillBlock(block)).toBe(true);
    expect(hasSkillBlock(blockStart)).toBe(false);
    expect(hasSkillBlock("nothing here")).toBe(false);
  });
});
