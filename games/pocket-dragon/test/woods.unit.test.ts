import { describe, expect, it } from "vitest";

import {
  cell,
  fireCooldown,
  frozen,
  gate,
  open,
  size,
  tree,
  turnSpeed,
} from "../src/rules/woods/constants.ts";
import {
  startWoods,
  woodsChapter,
  woodsRules,
} from "../src/rules/woods/index.ts";
import { distances, generateWoods, indexOf } from "../src/rules/woods/maze.ts";
import { breatheFire, tickWoods } from "../src/rules/woods/tick.ts";
import {
  along,
  cosOf,
  fullTurn,
  sinOf,
  unit,
} from "../src/rules/woods/trig.ts";
import type {
  Place,
  WoodsControl,
  WoodsState,
} from "../src/rules/woods/types.ts";

const seeds = Array.from({ length: 40 }, (_, at) => at * 104_729 + 3);
const ways = [
  { angle: 0, x: 1, y: 0 },
  { angle: 256, x: 0, y: 1 },
  { angle: 512, x: -1, y: 0 },
  { angle: 768, x: 0, y: -1 },
] as const;
const centre = (place: Place) => ({
  x: place.x * cell + cell / 2,
  y: place.y * cell + cell / 2,
});
const placeOf = (index: number): Place => ({
  x: index % size,
  y: Math.floor(index / size),
});

// Glitchy put in a cell next to `target`, facing it.
function facing(state: WoodsState, target: Place): WoodsState {
  const way = ways.find(
    (w) => state.level.walls[indexOf(target.x - w.x, target.y - w.y)] === open,
  );
  if (way === undefined) throw new Error("nowhere to stand");
  return {
    ...state,
    angle: way.angle,
    ...centre({ x: target.x - way.x, y: target.y - way.y }),
  };
}
const hold = (state: WoodsState, control: WoodsControl, on = true) => {
  const stepped = woodsRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: control,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};
const play = (state: WoodsState, count: number) => {
  let now = state;
  for (let at = 0; at < count; at += 1) now = tickWoods(now);
  return now;
};

describe("the woods' sums", () => {
  it("turn in 1,024 steps, with a cosine and sine of 4,096 at most that stay on the circle", () => {
    expect([cosOf(0), cosOf(256), cosOf(512), cosOf(768)]).toEqual([
      unit,
      0,
      -unit,
      0,
    ]);
    expect([sinOf(0), sinOf(256), sinOf(768)]).toEqual([0, unit, -unit]);
    for (let angle = 0; angle < fullTurn; angle += 7) {
      const length = Math.hypot(cosOf(angle), sinOf(angle));
      expect(Math.abs(length - unit)).toBeLessThan(3);
      expect(cosOf(angle + fullTurn)).toBe(cosOf(angle));
    }
    expect(along(0, 7)).toEqual([7, 0]);
    expect(along(512, 7)).toEqual([-7, 0]);
  });
});

describe("the woods' maze", () => {
  it("is laid out from the seed alone, closed by trees but for the moon gate", () => {
    expect(generateWoods(8)).toEqual(generateWoods(8));
    expect(generateWoods(8).walls).not.toEqual(generateWoods(9).walls);
    for (const seed of seeds) {
      const { gate: exit, walls } = generateWoods(seed);
      walls.forEach((wall, index) => {
        const { x, y } = placeOf(index);
        const border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
        if (border) expect(wall).toBe(index === exit ? gate : tree);
      });
      expect(walls.filter((wall) => wall === gate)).toHaveLength(1);
      expect(walls.filter((wall) => wall === frozen)).toHaveLength(1);
    }
  });

  it("lets Glitchy reach every path, and has its clues, chests and lanterns on paths, the moon chest behind the frozen hedge", () => {
    for (const seed of seeds) {
      const level = generateWoods(seed);
      const far = distances(level.walls, { x: 1, y: 1 });
      const behind = indexOf(level.moonChest.x, level.moonChest.y);
      level.walls.forEach((wall, index) => {
        if (wall === open && index !== behind)
          expect(far[index]).toBeGreaterThanOrEqual(0);
      });
      const things = [...level.clues, ...level.chests, ...level.lanterns];
      expect(new Set(things.map((p) => indexOf(p.x, p.y))).size).toBe(11);
      for (const place of things) {
        expect(level.walls[indexOf(place.x, place.y)]).toBe(open);
        expect(far[indexOf(place.x, place.y)]).toBeGreaterThan(0);
      }
      const door = placeOf(level.frozen);
      expect(
        Math.abs(door.x - level.moonChest.x) +
          Math.abs(door.y - level.moonChest.y),
      ).toBe(1);
      const opened = level.walls.map((wall) => (wall === frozen ? open : wall));
      expect(far[indexOf(level.moonChest.x, level.moonChest.y)]).toBe(-1);
      expect(
        distances(opened, { x: 1, y: 1 })[
          indexOf(level.moonChest.x, level.moonChest.y)
        ],
      ).toBeGreaterThan(0);
    }
  });
});

describe("the Whispering Woods' rules", () => {
  it("start from the seed, take no settings and refuse what they do not know", () => {
    expect(woodsRules.init(4, {})).toEqual({ ok: true, state: startWoods(4) });
    expect(woodsRules.init(4, { fog: 1 }).ok).toBe(false);
    expect(
      woodsRules.step(startWoods(4), {
        data: { on: 1, tick: 0 },
        type: "jump",
      }),
    ).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
  });

  it("turn with left and right, walk with up, back with down, and stop at the trees", () => {
    const start = startWoods(4);
    expect(play(hold(start, "right"), 10).angle).toBe(
      (start.angle + 10 * turnSpeed) % fullTurn,
    );
    expect(play(hold(start, "left"), 10).angle).toBe(
      (start.angle - 10 * turnSpeed + fullTurn) % fullTurn,
    );
    const ahead =
      start.level.walls[indexOf(2, 1)] === open
        ? { x: 1, y: 0 }
        : { x: 0, y: 1 };
    const walked = play(hold(start, "up"), 30);
    expect(
      (walked.x - start.x) * ahead.x + (walked.y - start.y) * ahead.y,
    ).toBeGreaterThan(150);
    const backed = play(hold(hold(walked, "up", false), "down"), 10);
    expect(
      (walked.x - backed.x) * ahead.x + (walked.y - backed.y) * ahead.y,
    ).toBeGreaterThan(0);
    const intoTrees = play(hold({ ...start, angle: 768 }, "up"), 60);
    expect(intoTrees.y).toBe(cell + 64 + 1);
    expect(intoTrees.visited.filter(Boolean)).toHaveLength(1);
  });

  it("light the lantern a breath of fire reaches, once a breath, with a rest between", () => {
    const start = startWoods(11);
    const lantern = start.level.lanterns[0] ?? { x: 1, y: 1 };
    const breathed = hold(facing(start, lantern), "fire");
    expect(breathed.lanterns[0]).toBe(true);
    expect(breathed.found).toEqual({ kind: "lantern", tick: breathed.tick });
    expect(breatheFire(breathed).breaths).toBe(1);
    const rested = play(hold(breathed, "fire", false), fireCooldown);
    expect(breatheFire(rested).breaths).toBe(2);
    const intoTrees = breatheFire({ ...start, angle: 768 });
    expect(intoTrees.breaths).toBe(1);
    expect(intoTrees.lanterns).toEqual(start.lanterns);
  });

  it("melt the frozen hedge with fire, and open the moon chest behind it", () => {
    const start = startWoods(11);
    const door = placeOf(start.level.frozen);
    const outside = {
      ...start.level.moonChest,
      x: 2 * door.x - start.level.moonChest.x,
      y: 2 * door.y - start.level.moonChest.y,
    };
    const way = ways.find(
      (w) => w.x === door.x - outside.x && w.y === door.y - outside.y,
    );
    const there = { ...start, angle: way?.angle ?? 0, ...centre(outside) };
    expect(play(hold(there, "up"), 80).moonChest).toBe(false);
    const melted = breatheFire(there);
    expect(melted.melted).toBe(true);
    expect(melted.found?.kind).toBe("melt");
    const opened = play(hold(melted, "up"), 80);
    expect(opened.moonChest).toBe(true);
    expect(opened.found?.kind).toBe("moon");
  });

  it("read a clue stone and open a chest by walking up to them", () => {
    const start = startWoods(11);
    const clue = start.level.clues[1] ?? { x: 1, y: 1 };
    const chest = start.level.chests[2] ?? { x: 1, y: 1 };
    const read = tickWoods({ ...start, ...centre(clue) });
    expect(read.clues).toEqual([false, true, false]);
    expect(read.found).toEqual({ kind: "clue", tick: 1 });
    const opened = tickWoods({ ...start, ...centre(chest) });
    expect(opened.chests[2]).toBe(true);
    expect(opened.found?.kind).toBe("chest");
  });

  it("keep the moon gate shut until all three clues are read, then let Glitchy out and take only the end", () => {
    const start = startWoods(11);
    const exit = placeOf(start.level.gate);
    const shut = hold(facing(start, exit), "up");
    expect(play(shut, 80).escaped).toBe(false);
    const out = play({ ...shut, clues: [true, true, true] }, 80);
    expect(out.escaped).toBe(true);
    expect(out.finishTick).not.toBeNull();
    expect(woodsChapter.done(out)).toBe(true);
    expect(tickWoods(out).tick).toBe(out.tick + 1);
    expect(
      woodsRules.step(out, { data: { on: 0, tick: out.tick }, type: "up" }),
    ).toEqual({
      ok: false,
      reason: "the run is over",
    });
  });
});
