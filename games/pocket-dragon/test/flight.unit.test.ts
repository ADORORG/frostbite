import { describe, expect, it } from "vitest";

import { flightSounds } from "../src/feedback-base.ts";
import {
  visionCooldown,
  visionCost,
  visionTicks,
} from "../src/rules/woods/constants.ts";
import { passable } from "../src/rules/woods/flight.ts";
import { countdownLeft } from "../src/rules/woods/lair.ts";
import type { Base, BaseGuard, WoodsState } from "../src/rules/woods/types.ts";
import { plasmaLeft, visionOn } from "../src/rules/woods/vision.ts";
import { futuresOf } from "../src/screen/frost-futures.ts";
import { flatFutures, frostHud, frostTint } from "../src/screen/frost-look.ts";
import { drawBase } from "../src/screen/woods-base.ts";
import { colour } from "../src/screen/palette.ts";
import { surface } from "./support/canvas.ts";
import {
  baseOf,
  inLair,
  outside,
  playFor,
  press,
} from "./support/woods-outside.ts";

const flying = (
  altitude: Base["altitude"],
  changes: Partial<Base> = {},
  more: Partial<WoodsState> = {},
) => outside({ altitude, ...changes }, more);
const rich = (more: Partial<WoodsState> = {}): Partial<WoodsState> => ({
  plasma: { ...outside().plasma, gathered: 25 },
  ...more,
});
const guardAt = (x: number, y: number, moved = 10_000): BaseGuard => ({
  dizzy: 0,
  moved,
  route: 0,
  toward: 1,
  x,
  y,
});

describe("flying out of the maze", () => {
  it("crosses water and small things flying low, the treetops soaring, but never DeFu's walls, her shut gate or a shadow dragon", () => {
    const base = baseOf(outside());
    expect(passable(base, 13, 19, 1)).toBe(true);
    expect(passable(base, 12, 22, 1)).toBe(true);
    expect(passable(base, 3, 22, 1)).toBe(false);
    expect(passable(base, 3, 22, 2)).toBe(true);
    expect(passable(base, 12, 13, 2)).toBe(false);
    expect(passable(base, 13, 13, 1)).toBe(false);
    expect(passable({ ...base, pieces: [true, true, true] }, 13, 13, 1)).toBe(
      true,
    );
    expect(passable(base, 13, 11, 2)).toBe(false);
    expect(
      passable({ ...base, shadows: [{ moved: 0, x: 2, y: 11 }] }, 2, 11, 1),
    ).toBe(false);
  });

  it("climbs and dives a height at a time, and says when there is no higher to go or no room to land", () => {
    const up = press(press(outside({ x: 4, y: 22 }), "climb"), "climb", false);
    expect(baseOf(up).altitude).toBe(1);
    const soaring = press(up, "climb");
    expect(baseOf(soaring).altitude).toBe(2);
    expect(press(press(soaring, "climb", false), "climb").found?.kind).toBe(
      "ceiling",
    );
    const overTree = { ...soaring, base: { ...baseOf(soaring), x: 3 } };
    expect(press(overTree, "dive").found?.kind).toBe("grounded");
    const overWater = flying(1, { x: 13, y: 19 });
    expect(press(overWater, "dive").found?.kind).toBe("grounded");
    expect(baseOf(press(flying(1), "dive")).altitude).toBe(0);
    const ground = outside();
    expect(press(ground, "dive").found).toBe(ground.found);
    expect(
      press(inLair({ altitude: 1, x: 1, y: 4 }), "climb").found?.kind,
    ).toBe("ceiling");
  });

  it("flies low over the pond and soars over the trees, a tile at a time", () => {
    const pond = playFor(
      press(flying(1, { facing: "right", x: 12, y: 19 }), "right"),
      1,
    );
    expect(baseOf(pond).x).toBe(13);
    const walked = playFor(
      press(outside({ facing: "right", x: 12, y: 19 }), "right"),
      1,
    );
    expect(baseOf(walked).x).toBe(12);
    const trees = playFor(
      press(flying(2, { facing: "left", x: 4, y: 22 }), "left"),
      1,
    );
    expect(baseOf(trees).x).toBe(3);
  });

  it("reaches nothing with the action key in the air, and nothing on the ground while soaring", () => {
    const cage = flying(1, { facing: "up", x: 12, y: 23 });
    expect(baseOf(press(cage, "act")).allies[0]).toBe(false);
    const soar = playFor(
      press(flying(2, { facing: "up", x: 10, y: 25 }), "up"),
      9,
    );
    expect(baseOf(soar).heartTaken).toBe(false);
    const low = playFor(
      press(flying(1, { facing: "up", x: 10, y: 25 }), "up"),
      9,
    );
    expect(baseOf(low).heartTaken).toBe(true);
  });

  it("is out of a guard's reach in the air, and over DeFu's shockwave, though not her laser", () => {
    const guarded = flying(1, { guards: [guardAt(13, 26, -100)] });
    expect(playFor(guarded, 30).hearts).toBe(guarded.hearts);
    const wave = (altitude: Base["altitude"]) =>
      playFor(inLair({ altitude, x: 16, y: 5 }, { tick: 202 }), 1);
    expect(wave(0).heartsLost).toBe(1);
    expect(wave(1).heartsLost).toBe(0);
    const laser = playFor(
      inLair(
        { altitude: 1, laser: { horizontal: true, line: 5 }, x: 16, y: 5 },
        { tick: 269 },
      ),
      2,
    );
    expect(laser.heartsLost).toBe(1);
  });
});

describe("frost vision", () => {
  it("costs metaplasma, lasts a while, and rests before it can be used again", () => {
    expect(press(outside(), "vision").found?.kind).toBe("weary");
    const on = press(outside({}, rich({ tick: 50 })), "vision");
    const base = baseOf(on);
    expect(on.found?.kind).toBe("frost");
    expect(on.plasmaSpent).toBe(visionCost);
    expect(plasmaLeft(on)).toBe(25 - visionCost);
    expect(base.visionUntil).toBe(50 + visionTicks);
    expect(base.visionReady).toBe(50 + visionTicks + visionCooldown);
    expect(visionOn(base, 50 + visionTicks)).toBe(false);
    const again = press(press(on, "vision", false), "vision");
    expect(again.found?.kind).toBe("weary");
    expect(again.plasmaSpent).toBe(visionCost);
  });

  it("makes the world wait every other tick: guards walk, and the rocket counts down, at half speed", () => {
    const walking = outside(
      { guards: [{ ...guardAt(16, 17, 0), route: 1 }] },
      rich(),
    );
    const plain = baseOf(playFor(walking, 56)).guards[0];
    const seeing = baseOf(playFor(press(walking, "vision"), 56)).guards[0];
    expect(plain?.x).toBe(20);
    expect(seeing?.x).toBe(18);
    const lair = inLair({ x: 1, y: 11 }, rich());
    expect(countdownLeft(baseOf(playFor(lair, 100)), 100)).toBe(7_100);
    const slowed = playFor(press(lair, "vision"), 100);
    expect(countdownLeft(baseOf(slowed), 100)).toBe(7_150);
  });

  it("plays three ways out with the rules, and says how each ends (the heart ahead, the berry to the left, nothing to the right)", () => {
    const heart = press(
      outside({ facing: "up", x: 10, y: 26 }, rich()),
      "vision",
    );
    const futures = futuresOf(heart);
    expect(futures.map((one) => one.way)).toEqual(["up", "left", "right"]);
    expect(futures[0]?.end).toBe("find");
    expect(futures[0]?.path).toEqual([
      { x: 10, y: 25 },
      { x: 10, y: 24 },
    ]);
    expect(futuresOf(heart)).toBe(futures);
    expect(futures.map((one) => one.end)).toEqual(["find", "find", "safe"]);
    const guarded = press(
      outside(
        { facing: "up", guards: [guardAt(13, 23, -100)], x: 12, y: 26 },
        rich(),
      ),
      "vision",
    );
    expect(futuresOf(guarded).some((one) => one.end === "hurt")).toBe(true);
    expect(futuresOf(outside())).toEqual([]);
  });

  it("is shown: the height and the vision's state under the hearts, the frost over the screen, the futures on their tiles", () => {
    const words = (state: WoodsState) => {
      const screen = surface();
      frostHud(screen.context, state, baseOf(state));
      return [...new Set(screen.texts())];
    };
    expect(words(outside())).toEqual(["E: FLY UP", "VISION: 10 PLASMA"]);
    expect(words(outside({ altitude: 2 }, rich()))).toEqual([
      "SOARING  Q: DOWN",
      "V: FROST VISION",
    ]);
    const on = press(outside({ facing: "up", x: 10, y: 26 }, rich()), "vision");
    expect(words(on)).toEqual(["E: FLY UP", "FROST VISION 5"]);
    expect(words({ ...on, tick: on.tick + visionTicks })).toEqual([
      "E: FLY UP",
      "VISION IN 15",
    ]);
    const tint = surface();
    frostTint(tint.context, on, baseOf(on));
    expect(tint.drawn.length).toBeGreaterThan(20);
    const off = surface();
    frostTint(off.context, outside(), baseOf(outside()));
    expect(off.drawn).toEqual([]);
    const marked = surface();
    flatFutures(marked.context, on, { x: 0, y: 0 });
    expect(marked.drawn.some((block) => block.fill === colour.gold)).toBe(true);
    const high = surface();
    drawBase(high.context, flying(2), baseOf(flying(2)));
    expect(high.drawn.some((block) => block.fill === colour.shadow)).toBe(true);
  });

  it("is heard: wings up, a flap down, and the frost coming on", () => {
    const ground = outside({}, rich());
    expect(flightSounds(ground, press(ground, "climb"))).toEqual(["wings"]);
    expect(flightSounds(flying(1), press(flying(1), "dive"))).toEqual(["flap"]);
    expect(flightSounds(ground, press(ground, "vision"))).toEqual(["frost"]);
    expect(flightSounds(outside(), press(outside(), "vision"))).toEqual([
      "talk",
    ]);
  });
});
