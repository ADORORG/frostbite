import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { sanitizeDrawing } from "@frostbite/milestone-art";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exists,
  gamesDirectory,
  registeredGames,
} from "./support/registered-games.ts";

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

// A game may ship a drawing for each milestone in `milestone-art/`, one file named for the milestone, ready for the staff page's "Define many
// milestones". They are held to the platform's own limits (what the checker would refuse, this refuses first), so a staff member never meets
// a refusal on a game's own files.
describe("the milestone drawings games ship", () => {
  it("are one for each milestone and no others, and every one passes the platform's drawing checker under its limits", async () => {
    const games = await registeredGames();
    const { gameAdminConfig } = await import("@repo/configs/game-admin");
    const { rewardsPolicy } = await import("@repo/configs/rewards-policy");
    const policy = {
      ...gameAdminConfig.drawingLimits,
      maxBytes: Number(rewardsPolicy.maxDrawingBytes),
    };
    let checked = 0;
    for (const game of games) {
      const directory = join(gamesDirectory, game.id, "milestone-art");
      if (!(await exists(directory))) continue;
      const files = (await readdir(directory)).sort();
      expect(
        files,
        `${game.id}: one .svg for each milestone, named for it`,
      ).toEqual(game.milestones.map(({ id }) => `${id}.svg`).sort());
      for (const file of files) {
        const source = await readFile(join(directory, file), "utf8");
        const result = sanitizeDrawing(source.trim(), policy);
        expect(
          result.ok,
          `${game.id}/${file}: ${result.ok ? "" : `${result.reason}: ${result.detail}`}`,
        ).toBe(true);
        // The platform writes the cleaned copy, so the file should already be it: nothing for staff to be surprised by.
        expect(
          result.ok && result.svg,
          `${game.id}/${file} is not in canonical form`,
        ).toBe(source.trim());
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("are refused by the same checker when they break a rule, so the test above can fail", () => {
    const policy = {
      maxAttributeLength: 4096,
      maxBytes: 16_384,
      maxDepth: 8,
      maxElements: 200,
    };
    const text =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><text/></svg>';
    expect(sanitizeDrawing(text, policy)).toMatchObject({
      ok: false,
      reason: "unknown-element",
    });
    const tooMany = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">${'<rect x="0" y="0" width="1" height="1"/>'.repeat(201)}</svg>`;
    expect(sanitizeDrawing(tooMany, policy)).toMatchObject({
      ok: false,
      reason: "too-complex",
    });
  });
});
