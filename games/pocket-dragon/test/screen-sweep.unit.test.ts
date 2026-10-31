import { describe, expect, it } from "vitest";

import { challenge, moves, perform } from "../src/rules/castle/battle.ts";
import { mapHeight, mapWidth } from "../src/rules/castle/map.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import type { CastleState } from "../src/rules/castle/types.ts";
import { levelTiles, tile } from "../src/rules/hills/constants.ts";
import { startHills } from "../src/rules/hills/state.ts";
import type { HillsState } from "../src/rules/hills/types.ts";
import { cell, open, size } from "../src/rules/woods/constants.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import type { WoodsState } from "../src/rules/woods/types.ts";
import { drawCastle } from "../src/screen/castle-draw.ts";
import { drawHills } from "../src/screen/hills-draw.ts";
import { friendKey } from "../src/screen/sprites.ts";
import { drawWoods } from "../src/screen/woods-draw.ts";
import { surface, type Drawn } from "./support/canvas.ts";

// Every frame of a chapter, wherever Glitchy is and whatever has been done, is drawn in the screen's own colours with whole numbers: a
// picture that names a colour its key does not have, or a sum that goes wrong, shows here as a block that is not.
const colourLike = /^(#[0-9a-f]{3,8}|rgb\(.+\)|gradient)$/iu;
function badBlocks<State>(
  draw: (context: CanvasRenderingContext2D, state: State) => void,
  states: readonly State[],
): readonly Drawn[] {
  const bad: Drawn[] = [];
  for (const state of states) {
    const screen = surface();
    draw(screen.context, state);
    expect(screen.drawn.length).toBeGreaterThan(0);
    for (const block of screen.drawn)
      if (
        !colourLike.test(block.fill) ||
        ![block.x, block.y, block.width, block.height].every(Number.isFinite)
      )
        bad.push(block);
  }
  return bad;
}

describe("every frame", () => {
  it("of Egg Hills, all along each stage, in every pose", () => {
    const states: HillsState[] = [];
    for (const stage of [1, 2, 3]) {
      const start = { ...startHills(17), stage };
      for (let column = 0; column < levelTiles; column += 3) {
        const at = column * 3 + stage;
        states.push({
          ...start,
          berryTaken: at % 2 === 0,
          checkpoint: column > 75,
          eggsTaken: start.eggsTaken.map((_, egg) => egg % 3 === at % 3),
          fireCooldown: at % 5 === 0 ? 15 : 0,
          glooms: start.glooms.map((gloom, index) =>
            index % 2 === 0 ? gloom : { ...gloom, alive: false, cheered: at },
          ),
          goldenTaken: at % 4 === 0,
          hasFire: true,
          hero: {
            ...start.hero,
            facing: at % 2 === 0 ? 1 : -1,
            grounded: at % 3 !== 0,
            vx: at % 7 === 0 ? 0 : 20,
            x: column * tile,
          },
          invulnerable: at % 11 === 0 ? 30 : 0,
          melted: start.melted.map((_, ice) => ice % 2 === 0),
          tick: at * 7,
        });
      }
    }
    expect(badBlocks(drawHills, states)).toEqual([]);
  });

  it("of the Whispering Woods, from every path and every way, before and after things are found", () => {
    const start = startWoods(23);
    const states: WoodsState[] = [];
    start.level.walls.forEach((wall, index) => {
      if (wall !== open) return;
      const x = (index % size) * cell + cell / 2;
      const y = Math.floor(index / size) * cell + cell / 2;
      for (const angle of [0, 256, 512, 768, 100]) {
        const done = (index + angle) % 3 === 0;
        states.push({
          ...start,
          angle,
          breathTick: done ? 5 : -1,
          chests: start.chests.map(() => done),
          clues: start.clues.map(() => done),
          lanterns: start.lanterns.map(() => done),
          melted: done,
          moonChest: done,
          tick: 10,
          x,
          y,
        });
      }
    });
    expect(badBlocks(drawWoods, states)).toEqual([]);
  });

  it("of the guild's chapter, over the whole land, with the guild growing and the challenges going", () => {
    const start = startCastle(29);
    const yes = [true, true, true, true];
    const states: CastleState[] = [];
    for (let y = 0; y < mapHeight; y += 4)
      for (let x = 0; x < mapWidth; x += 5) {
        const done = (x + y) % 2 === 0;
        states.push({
          ...start,
          cheered: done ? yes : [true, false, false, false],
          facing:
            (["up", "down", "left", "right"] as const)[(x + y) % 4] ?? "down",
          friends: done ? yes : [true, false, false, false],
          held: [false, true, false, true],
          lilies: done,
          melted: done,
          opened: [done, done],
          pushed: [done, done],
          step: done ? { from: { x: x - 1, y }, start: 0 } : null,
          taken: [done, false, done, false],
          tick: 4 + x + y,
          trail: done
            ? [
                { x: x - 1, y },
                { x: x - 2, y },
                { x: x - 3, y },
                { x: x - 4, y },
              ]
            : [],
          x,
          y,
        });
      }
    const guild = { ...start, friends: yes, tick: 100 };
    for (let foe = 0; foe < 4; foe += 1)
      moves.forEach((_, move) => {
        const asked = challenge(
          { ...guild, favourites: [move, move, move, move] },
          foe,
        );
        const battle = asked.battle && { ...asked.battle, choice: move };
        const shown = perform({ ...asked, battle });
        for (const since of [1, 20, 40])
          states.push({ ...shown, tick: shown.tick + since });
      });
    expect(badBlocks(drawCastle, states)).toEqual([]);
    expect(friendKey(9)).toEqual(friendKey(0));
  });
});
