import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sanitizeDrawing } from "@frostbite/milestone-art";
import { describe, expect, it } from "vitest";

import { milestoneIds } from "../src/rules/milestones.ts";

// Each milestone's drawing is a file named for it (`found-kai.svg` is the drawing of `found-kai`), so the staff page can define them all
// from the folder at once ("Define many milestones" matches a file to a milestone by its name). Each is checked here by the platform's
// own sanitiser, with the platform's limits (`drawingLimits` in configs/game-admin.ts) and the bytes held to half the ceiling
// (`maxDrawingBytes` in configs/rewards-policy.ts), so none can be refused there, and each is already in the form the platform keeps.
const folder = join(import.meta.dirname, "../milestone-arts");
const policy = {
  maxAttributeLength: 4096,
  maxBytes: 8192,
  maxDepth: 8,
  maxElements: 200,
};

describe("the milestones' drawings", () => {
  it("are one for each milestone, named for it, and no more", () => {
    const files = readdirSync(folder).sort();
    expect(files).toEqual(milestoneIds.map((id) => `${id}.svg`).sort());
  });

  for (const id of milestoneIds)
    it(`passes the platform's checks unchanged: ${id}`, () => {
      const drawing = readFileSync(join(folder, `${id}.svg`), "utf8").trim();
      expect(sanitizeDrawing(drawing, policy)).toEqual({
        ok: true,
        svg: drawing,
      });
    });
});
