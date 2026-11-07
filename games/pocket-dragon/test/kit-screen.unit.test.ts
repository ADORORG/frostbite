import { Scene } from "three";
import { describe, expect, it } from "vitest";

import { packSounds } from "../src/feedback-kit.ts";
import { blazeTicks, emptyPack, startPowers } from "../src/rules/kit.ts";
import { kitSpots } from "../src/rules/castle/places.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { tile } from "../src/rules/hills/constants.ts";
import { baseKit } from "../src/rules/woods/base-map.ts";
import { drawCastle } from "../src/screen/castle-draw.ts";
import { castleKit } from "../src/screen/castle-kit.ts";
import { hillsHero, kitThings } from "../src/screen/hills-kit.ts";
import {
  kitIcons,
  rollingAt,
  spriteScaled,
} from "../src/screen/kit-sprites.ts";
import { colour } from "../src/screen/palette.ts";
import {
  drawPack,
  newsTicks,
  packWords,
  packX,
} from "../src/screen/pack-hud.ts";
import { baseKitLook } from "../src/screen/woods-base-kit.ts";
import { drawBase } from "../src/screen/woods-base.ts";
import {
  blastLookTicks,
  mazeBlastLook,
  thingsOf,
} from "../src/screen/woods-things.ts";
import { makeKitProps, showKitProps } from "../src/three/kit.ts";
import { surface } from "./support/canvas.ts";
import { flatHills } from "./support/hills-world.ts";
import { baseOf, maze, outside } from "./support/woods-outside.ts";

const filled = (more: Partial<typeof emptyPack>) =>
  startPowers({ big: false, pack: { ...emptyPack, ...more } });

describe("the backpack on the screen", () => {
  it("stays out of the way while it is empty", () => {
    const screen = surface();
    drawPack(screen.context, startPowers(), 10);
    expect(screen.drawn).toEqual([]);
    expect(screen.written).toEqual([]);
  });

  it("shows each food with its count, a flame bar in a blaze, and BIG", () => {
    const screen = surface();
    drawPack(
      screen.context,
      { ...filled({ mushroom: 2 }), big: true, blaze: blazeTicks / 2 },
      10,
    );
    expect(screen.texts()).toEqual(expect.arrayContaining(["0", "2", "BIG"]));
    expect(
      screen.drawn.some(
        (block) => block.fill === colour.fire && block.x === packX - 2,
      ),
    ).toBe(true);
    expect(
      screen.drawn.filter((block) => block.fill === colour.pink).length,
    ).toBeGreaterThan(0);
  });

  it("says what was put in, used, or took a bump, for a little while", () => {
    const powers = filled({ berry: 1 });
    const news = (
      what: "packed" | "shrank" | "used",
      item = "berry" as const,
    ) => ({
      ...powers,
      news: { item, tick: 0, what },
    });
    expect(packWords(news("packed"), 1)?.text).toBe(
      "A BERRY! B FOR LONGER FIRE",
    );
    expect(packWords(news("used"), 1)?.text).toBe("BLAZING FIRE!");
    expect(packWords(news("shrank"), 1)?.text).toBe(
      "THE PINEAPPLE TOOK THE BUMP!",
    );
    expect(packWords(news("used"), newsTicks)).toBeNull();
    const screen = surface();
    drawPack(screen.context, news("packed"), 1);
    expect(screen.texts()).toContain("A BERRY! B FOR LONGER FIRE");
  });

  it("draws a picture twice the size, a pixel to every two", () => {
    const screen = surface();
    spriteScaled(screen.context, ["k."], { k: colour.ink }, 3, 4, 2);
    expect(screen.drawn).toEqual([
      { fill: colour.ink, height: 2, width: 2, x: 3, y: 4 },
    ]);
    expect(kitIcons.berry).toHaveLength(7);
  });

  it("is heard as a food goes in, is used, and takes a bump", () => {
    const before = startPowers();
    const at = (
      what: "packed" | "shrank" | "used",
      item: "berry" | "mushroom" | "pineapple",
    ) => ({
      ...before,
      news: { item, tick: 3, what },
    });
    expect(packSounds(before, before)).toEqual([]);
    expect(packSounds(before, at("packed", "berry"))).toEqual(["pack"]);
    expect(packSounds(before, at("used", "berry"))).toEqual(["blaze"]);
    expect(packSounds(before, at("used", "mushroom"))).toEqual(["blast"]);
    expect(packSounds(before, at("used", "pineapple"))).toEqual(["grow"]);
    expect(packSounds(before, at("shrank", "pineapple"))).toEqual(["shrink"]);
  });
});

describe("the backpack drawn in each level", () => {
  it("lays the foods along Egg Hills until picked up, rolls the blasts, and draws a big Glitchy twice as tall", () => {
    const food = { item: "mushroom" as const, x: 5 * tile, y: 6 * tile };
    const state = flatHills(
      { kit: [food] },
      { blasts: [{ life: 9, vx: 40, vy: 0, x: 6 * tile, y: 6 * tile }] },
    );
    const screen = surface();
    kitThings(screen.context, state, 0);
    expect(screen.drawn.some((block) => block.fill === colour.pink)).toBe(true);
    const gone = surface();
    kitThings(gone.context, { ...state, blasts: [], kitTaken: [true] }, 0);
    expect(gone.drawn).toEqual([]);
    const small = surface();
    hillsHero(small.context, state, 0);
    const big = surface();
    hillsHero(
      big.context,
      { ...state, powers: { ...state.powers, big: true } },
      0,
    );
    const height = (drawn: typeof small.drawn) =>
      Math.max(...drawn.map((b) => b.y + b.height)) -
      Math.min(...drawn.map((b) => b.y));
    expect(height(big.drawn)).toBe(height(small.drawn) * 2);
  });

  it("lays the castle's foods on the map, rolls its blast between tiles, and draws the backpack over the land", () => {
    const [first] = kitSpots;
    if (first === undefined) throw new Error("no food on the map");
    const state = {
      ...startCastle(3),
      blast: { dx: 1, dy: 0, left: 5, moved: 0, x: 11, y: 22 },
      powers: filled({ pineapple: 1 }),
      tick: 1,
      x: first.x - 2,
      y: first.y,
    };
    expect(rollingAt(state.blast, 1).x).toBeCloseTo(10 + 1 / 3);
    const screen = surface();
    castleKit(screen.context, state, { x: 0, y: 0 });
    expect(screen.drawn.some((block) => block.fill === colour.berry)).toBe(
      true,
    );
    expect(screen.drawn.some((block) => block.fill === colour.cyan)).toBe(true);
    const whole = surface();
    drawCastle(whole.context, state);
    expect(whole.texts()).toContain("1");
  });

  it("stands the maze's foods as pictures until picked up, and rolls a blast away down the maze", () => {
    const seen = thingsOf(maze).length;
    expect(thingsOf({ ...maze, kitTaken: [true, true, true] })).toHaveLength(
      seen - 3,
    );
    const used = {
      ...maze,
      powers: {
        ...startPowers(),
        news: { item: "mushroom" as const, tick: 0, what: "used" as const },
      },
      tick: 5,
    };
    const rolling = surface();
    mazeBlastLook(rolling.context, used);
    expect(rolling.drawn.length).toBeGreaterThan(0);
    const done = surface();
    mazeBlastLook(done.context, { ...used, tick: blastLookTicks });
    expect(done.drawn).toEqual([]);
  });

  it("lays the foods out of the maze on their tiles, and rolls a blast over them, flat and in three dimensions", () => {
    const state = outside(
      { blast: { dx: 0, dy: -1, left: 4, moved: 0, x: 12, y: 25 } },
      { tick: 1 },
    );
    const base = baseOf(state);
    const screen = surface();
    baseKitLook(screen.context, base, 1, { x: 0, y: 0 });
    expect(screen.drawn.some((block) => block.fill === colour.gold)).toBe(true);
    expect(screen.drawn.some((block) => block.fill === colour.cyan)).toBe(true);
    const big = surface();
    drawBase(
      big.context,
      { ...state, powers: { ...startPowers(), big: true } },
      base,
    );
    const bigMint = (drawn: typeof big.drawn) =>
      drawn.filter((block) => block.fill === colour.mint && block.width === 2)
        .length;
    expect(bigMint(big.drawn)).toBeGreaterThan(0);
    const small = surface();
    drawBase(small.context, state, base);
    expect(bigMint(small.drawn)).toBe(0);
    const scene = new Scene();
    const props = makeKitProps(scene);
    expect(props.foods).toHaveLength(baseKit.length);
    expect(props.blast.visible).toBe(false);
    showKitProps(
      props,
      state,
      { ...base, kitTaken: [true, false, false, false] },
      1,
    );
    expect(props.foods.map((food) => food.visible)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(props.blast.visible).toBe(true);
    expect(props.blast.position.z).toBeCloseTo(26.5 - 1 / 3, 5);
    showKitProps(props, state, { ...base, blast: null }, 2);
    expect(props.blast.visible).toBe(false);
  });
});
