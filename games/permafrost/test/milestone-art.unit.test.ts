import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { drawingIds, drawingOf } from "../art/index.ts";
import { tiers } from "../art/svg.ts";
import { milestoneIds } from "../src/rules/milestones.ts";

const directory = join(import.meta.dirname, "../milestone-art");

describe("the milestone drawings", () => {
  it("are one for each milestone the rules award, and for nothing else", () => {
    expect([...drawingIds].sort()).toEqual([...milestoneIds].sort());
  });

  it("are the files in milestone-art, byte for byte, so a change to the generator shows as a change to the files (pnpm art writes them)", () => {
    for (const id of drawingIds)
      expect(readFileSync(join(directory, `${id}.svg`), "utf8")).toBe(
        `${drawingOf(id) ?? ""}\n`,
      );
  });

  it("give every milestone its own picture, so no two are mistaken for each other", () => {
    const all = drawingIds.map((id) => drawingOf(id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("show how hard a milestone is by the colour of the frame and the dots under it, harder in more of both", () => {
    const frames = tiers.map(({ colour }) => colour);
    expect(new Set(frames).size).toBe(4);
    const dots = (id: string) =>
      (drawingOf(id)?.match(/<circle /g) ?? []).length;
    expect(dots("first-line")).toBe(1);
    expect(dots("lines-50")).toBe(2);
    expect(dots("lines-150")).toBe(3);
    expect(dots("lines-200")).toBe(4);
    expect(drawingOf("lines-200")).toContain(tiers[3]?.colour);
  });

  it("have no drawing for a milestone the game does not have", () => {
    expect(drawingOf("no-such-milestone")).toBeNull();
  });
});
