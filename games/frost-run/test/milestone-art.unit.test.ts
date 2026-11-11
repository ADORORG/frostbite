import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sanitizeDrawing } from "@frostbite/milestone-art";
import { describe, expect, it } from "vitest";

import { milestones } from "../src/rules/milestones.ts";

// Each milestone's drawing, for the staff page that defines it on the game's contract, is checked here by the platform's own sanitizer,
// so it cannot be refused there. The limits are the platform's (`maxDrawingBytes` in configs/rewards-policy.ts, `drawingLimits` in
// configs/game-admin.ts); the bytes are held to half the ceiling, so a drawing has room to grow and the contract can be made smaller.
const folder = join(import.meta.dirname, "../milestones");
const policy = {
  maxAttributeLength: 4096,
  maxBytes: 8192,
  maxDepth: 8,
  maxElements: 200,
};

describe("the milestones' drawings", () => {
  it("are one for each milestone and no more", () => {
    const files = readdirSync(folder)
      .filter((name) => name.endsWith(".svg"))
      .map((name) => name.slice(0, -4))
      .sort();
    expect(files).toEqual(milestones.map(({ id }) => id).sort());
  });

  for (const { id } of milestones)
    it(`passes the platform's checks: ${id}`, () => {
      const drawing = readFileSync(join(folder, `${id}.svg`), "utf8").trim();
      const checked = sanitizeDrawing(drawing, policy);
      expect(checked).toMatchObject({ ok: true });
      expect(drawing.toLowerCase()).not.toContain("#f7931a");
    });
});
