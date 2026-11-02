import { describe, expect, it } from "vitest";

import { emptyPack, startPowers, type Pack } from "../src/rules/kit.ts";
import { baseKit } from "../src/rules/woods/base-map.ts";
import {
  baseStep,
  dizzyTicks as woodsDizzy,
  invulnerableTicks,
  open,
  tree,
} from "../src/rules/woods/constants.ts";
import { mazeBlast, takeBaseKit } from "../src/rules/woods/powers.ts";
import { tickWoods } from "../src/rules/woods/tick.ts";
import type { BaseGuard, WoodsState } from "../src/rules/woods/types.ts";
import {
  baseOf,
  inLair,
  maze,
  outside,
  playFor,
  press,
} from "./support/woods-outside.ts";

const packed = (more: Partial<Pack>) =>
  startPowers({ big: false, pack: { ...emptyPack, ...more } });

// A row of the maze open from end to end (row 1), with trees everywhere else; Glitchy at its west end facing east.
const corridor = (
  walls: Readonly<Record<number, number>>,
  lanterns: readonly { readonly x: number; readonly y: number }[],
  more: Partial<WoodsState> = {},
): WoodsState => ({
  ...maze,
  angle: 0,
  lanterns: lanterns.map(() => false),
  level: {
    ...maze.level,
    lanterns,
    walls: maze.level.walls.map((_, at) => {
      const x = at % 17;
      if (Math.floor(at / 17) !== 1 || x < 1 || x > 15) return tree;
      return walls[x] ?? open;
    }),
  },
  x: 384,
  y: 384,
  ...more,
});

describe("the backpack in the woods", () => {
  it("lays one of each food in rooms of the maze nothing else uses, and picks one up from close by", () => {
    const { kit } = maze.level;
    expect(kit.map((spot) => spot.item)).toEqual([
      "berry",
      "mushroom",
      "pineapple",
    ]);
    const used = [
      ...maze.level.chests,
      ...maze.level.clues,
      ...maze.level.eggs,
      ...maze.level.parts,
    ];
    for (const spot of kit)
      expect(used.some((p) => p.x === spot.x && p.y === spot.y)).toBe(false);
    const [first] = kit;
    if (first === undefined) throw new Error("no food in the maze");
    const near = tickWoods({
      ...maze,
      x: first.x * 256 + 128,
      y: first.y * 256 + 128,
    });
    expect(near.kitTaken).toEqual([true, false, false]);
    expect(near.powers.pack.berry).toBe(1);
  });

  it("sends fire twice as far down the maze in a berry's blaze", () => {
    const lit = (state: WoodsState) => press(state, "fire").lanterns;
    expect(lit(corridor({}, [{ x: 5, y: 1 }]))).toEqual([false]);
    const blazing = press(
      corridor({}, [{ x: 5, y: 1 }], { powers: packed({ berry: 1 }) }),
      "berry",
    );
    expect(lit(blazing)).toEqual([true]);
  });

  it("rolls a glitch blast down the maze, lighting every lantern and melting the frozen hedge on its way, up to a tree", () => {
    const state = corridor({ 3: 2, 9: tree }, [
      { x: 4, y: 1 },
      { x: 6, y: 1 },
      { x: 10, y: 1 },
    ]);
    const rolled = mazeBlast(state);
    expect(rolled.melted).toBe(true);
    expect(rolled.lanterns).toEqual([true, true, false]);
    expect(rolled.found?.kind).toBe("lantern");
    const used = press(
      { ...state, powers: packed({ mushroom: 1 }) },
      "mushroom",
    );
    expect(used.lanterns).toEqual([true, true, false]);
    expect(mazeBlast({ ...state, angle: 512 }).found).toBe(state.found);
  });

  it("picks up the foods out of the maze by stepping onto them", () => {
    const [first] = baseKit;
    if (first === undefined) throw new Error("no food out of the maze");
    const state = outside();
    const took = takeBaseKit(state, {
      ...baseOf(state),
      x: first.x,
      y: first.y,
    });
    expect(took.powers.pack[first.item]).toBe(1);
    expect(baseOf(took).kitTaken[0]).toBe(true);
    const walked = playFor(
      press(outside({ facing: "right", x: first.x - 1, y: first.y }), "right"),
      baseStep + 1,
    );
    expect(walked.powers.pack[first.item]).toBe(1);
  });

  const guardAt = (x: number, y: number, moved = 10_000): BaseGuard => ({
    dizzy: 0,
    moved,
    route: 0,
    toward: 1,
    x,
    y,
  });

  it("reaches three tiles with fire in a berry's blaze", () => {
    const state = outside({
      facing: "right",
      guards: [guardAt(15, 26)],
      x: 12,
      y: 26,
    });
    expect(baseOf(press(state, "fire")).guards[0]?.dizzy).toBe(0);
    const blazing = press({ ...state, powers: packed({ berry: 1 }) }, "berry");
    expect(baseOf(press(blazing, "fire")).guards[0]?.dizzy).toBe(woodsDizzy);
  });

  it("rolls a glitch blast over the tiles, sending guards home, freeing shadow dragons and breaking a valve", () => {
    const woods = press(
      outside(
        {
          facing: "right",
          guards: [guardAt(14, 26), guardAt(17, 26)],
          x: 12,
          y: 26,
        },
        { powers: packed({ mushroom: 2 }) },
      ),
      "mushroom",
    );
    expect(
      press(press(woods, "mushroom", false), "mushroom").powers.pack.mushroom,
    ).toBe(1);
    const rolled = playFor(woods, 20);
    expect(baseOf(rolled).guards).toEqual([]);
    expect(baseOf(rolled).cheered).toBe(2);
    expect(baseOf(playFor(rolled, 40)).blast).toBeNull();
    const hall = press(
      inLair(
        {
          facing: "right",
          shadows: [{ moved: 10_000, x: 2, y: 4 }],
          x: 1,
          y: 4,
        },
        { powers: packed({ mushroom: 1 }) },
      ),
      "mushroom",
    );
    const cleared = baseOf(playFor(hall, 8));
    expect(cleared.freed).toBe(1);
    expect(cleared.broken[0]).toBe(true);
    expect(cleared.blast).toBeNull();
  });

  it("only shrinks a big Glitchy when a guard bumps it", () => {
    const state = outside(
      { guards: [guardAt(13, 26, -100)], x: 12, y: 26 },
      { powers: { ...startPowers(), big: true } },
    );
    const bumped = playFor(state, 1);
    expect(bumped.hearts).toBe(state.hearts);
    expect(bumped.powers.big).toBe(false);
    expect(baseOf(bumped).invulnerable).toBe(invulnerableTicks);
  });
});
