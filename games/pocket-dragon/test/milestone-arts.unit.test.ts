import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { milestoneIds } from "../src/rules/milestones.ts";

// The staff page's "Define many milestones" matches each drawing to its milestone by the file's name: `first-egg.svg` draws `first-egg`.
// A file named any other way (a number, a title) matches nothing there, so the folder must hold one file per milestone, named for its id.
describe("the milestone drawings", () => {
  it("are one file for each milestone, named for its id", () => {
    const files = readdirSync(join(import.meta.dirname, "../milestone-arts"))
      .map((name) => name.replace(/\.svg$/u, ""))
      .sort();
    expect(files).toEqual([...milestoneIds].sort());
  });
});
