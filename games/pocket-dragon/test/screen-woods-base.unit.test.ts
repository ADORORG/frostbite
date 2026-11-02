import { describe, expect, it } from "vitest";

import { sceneTicks } from "../src/rules/woods/scenes.ts";

import { bubbleSpot, defu, heartSpot } from "../src/rules/woods/base-map.ts";
import {
  laserEvery,
  laserOn,
  laserWarn,
  waveFirst,
  waveWarn,
} from "../src/rules/woods/constants.ts";
import type { FoundKind, WoodsState } from "../src/rules/woods/types.ts";
import { colour } from "../src/screen/palette.ts";
import {
  baseCamera,
  drawBase,
  glitchyOnBase,
} from "../src/screen/woods-base.ts";
import { baseHud, doneWords, nextStep } from "../src/screen/woods-base-hud.ts";
import { drawWoods } from "../src/screen/woods-screen.ts";
import { count, drawnWith, sound } from "./support/drawn.ts";
import { baseOf, inLair, maze, outside } from "./support/woods-outside.ts";

const flat = (context: CanvasRenderingContext2D, state: WoodsState) =>
  drawBase(context, state, baseOf(state));
const hud = (context: CanvasRenderingContext2D, state: WoodsState) =>
  baseHud(context, state, baseOf(state));

describe("the woods outside the maze, drawn flat", () => {
  it("follow Glitchy, partway along a step, and never look past the edge of the map", () => {
    const standing = baseOf(outside());
    expect(glitchyOnBase(standing, 50)).toEqual({ x: 12 * 16, y: 26 * 16 });
    const stepping = {
      ...standing,
      step: { from: { x: 12, y: 27 }, start: 10 },
      y: 26,
    };
    expect(glitchyOnBase(stepping, 14)).toEqual({ x: 12 * 16, y: 26 * 16 + 8 });
    expect(glitchyOnBase(stepping, 30)).toEqual({ x: 12 * 16, y: 26 * 16 });
    expect(baseCamera(standing, 0)).toEqual({
      x: 12 * 16 + 8 - 128,
      y: 28 * 16 - 144,
    });
    expect(baseCamera({ ...standing, x: 1, y: 1 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it("show the forcefield bubble and the heart until they are taken, the guards (dizzy ones seeing stars) and the dragons following", () => {
    const near = outside({ x: bubbleSpot.x, y: bubbleSpot.y + 2 });
    expect(count(flat, near, colour.cyan)).toBeGreaterThan(
      count(flat, outside({ ...baseOf(near), bubbleTaken: true }), colour.cyan),
    );
    const byHeart = outside({ x: heartSpot.x, y: heartSpot.y + 1 });
    expect(count(flat, byHeart, colour.berry)).toBeGreaterThan(
      count(
        flat,
        outside({ ...baseOf(byHeart), heartTaken: true }),
        colour.berry,
      ),
    );
    const guard = {
      dizzy: 0,
      moved: 0,
      route: 0,
      toward: 1 as const,
      x: 11,
      y: 26,
    };
    const guarded = outside({ guards: [guard] });
    expect(
      count(flat, outside({ guards: [{ ...guard, dizzy: 9 }] }), colour.gold),
    ).toBeGreaterThan(count(flat, guarded, colour.gold));
    const freed = outside({
      allies: [true, false, false],
      trail: [{ x: 12, y: 27 }],
    });
    expect(drawnWith(flat, freed).drawn.length).toBeGreaterThan(
      drawnWith(flat, outside({ allies: [true, false, false] })).drawn.length,
    );
    const flight = { dx: -1, dy: 0, left: 3, moved: 0, x: 10, y: 26 };
    expect(drawnWith(flat, outside({ flight })).drawn.length).toBeGreaterThan(
      drawnWith(flat, outside()).drawn.length,
    );
    const shielded = outside({ forcefield: 30 });
    expect(count(flat, shielded, colour.cyan)).toBe(
      count(flat, outside(), colour.cyan) + 16,
    );
    expect(sound(flat, [near, byHeart, guarded, freed, shielded])).toBe(true);
  });

  it("blink Glitchy after a bump, and in the lair show DeFu, her shadow dragons, her laser glowing then burning, and her shockwave", () => {
    const blinking = outside({ invulnerable: 40 });
    expect(
      drawnWith(flat, { ...blinking, tick: 4 }).drawn.length,
    ).toBeGreaterThan(drawnWith(flat, blinking).drawn.length);
    const lair = inLair({ x: 12, y: 6 }, { tick: 10 });
    const shadowed = inLair(
      { shadows: [{ moved: 0, x: 10, y: 6 }], x: 12, y: 6 },
      { tick: 10 },
    );
    expect(drawnWith(flat, shadowed).drawn.length).toBeGreaterThan(
      drawnWith(flat, lair).drawn.length,
    );
    const glow = laserEvery - laserOn - laserWarn;
    const laser = { horizontal: true, line: 6 };
    const thin = drawnWith(
      flat,
      inLair({ laser, x: 12, y: 6 }, { tick: glow }),
    ).drawn;
    expect(
      thin.some(
        (block) =>
          block.fill === colour.berry &&
          block.height === 1 &&
          block.width > 300,
      ),
    ).toBe(true);
    const beam = drawnWith(
      flat,
      inLair({ laser, x: 12, y: 6 }, { tick: glow + laserWarn }),
    ).drawn;
    expect(
      beam.some((block) => block.fill === colour.fireHot && block.height === 6),
    ).toBe(true);
    const column = drawnWith(
      flat,
      inLair(
        { laser: { horizontal: false, line: 9 }, x: 12, y: 6 },
        { tick: glow },
      ),
    ).drawn;
    expect(
      column.some((block) => block.fill === colour.berry && block.width === 1),
    ).toBe(true);
    const lavender = (tick: number) =>
      count(flat, inLair({ x: 12, y: 6 }, { tick }), colour.lavender);
    expect(lavender(waveFirst)).toBeGreaterThan(lavender(waveFirst - 1));
    const ring = drawnWith(
      flat,
      inLair({ x: defu.x, y: 8 }, { tick: waveFirst + waveWarn + 4 }),
    ).drawn;
    expect(
      ring.some(
        (block) => block.fill === colour.pink && block.width === 5 * 16,
      ),
    ).toBe(true);
    expect(
      sound(flat, [
        lair,
        shadowed,
        inLair({ x: 12, y: 9 }, { tick: waveFirst + waveWarn + 30 }),
      ]),
    ).toBe(true);
  });
});

describe("what is written over the woods outside the maze", () => {
  it("counts the hearts, the dragons freed and keys found, then in the lair the keys fitted, the valves broken and the rocket's countdown", () => {
    const woods = outside(
      { allies: [true, false, true], ammo: 3, pieces: [true, false, false] },
      { hearts: 4 },
    );
    expect(drawnWith(hud, woods).texts()).toEqual(
      expect.arrayContaining(["ALLIES 2/3", "KEYS 1/3", "EGGS 3  PLASMA 0"]),
    );
    const hearts = (many: number) =>
      count(hud, outside({}, { hearts: many }), colour.berry);
    expect(hearts(1)).toBeGreaterThan(0);
    expect(hearts(4) - hearts(3)).toBe(hearts(1));
    const lair = inLair(
      { broken: [true, true, false], installed: [true, false, false] },
      { tick: 600 },
    );
    expect(drawnWith(hud, lair).texts()).toEqual(
      expect.arrayContaining(["PANELS 1/3", "VALVES 2/3", "ROCKET 1:50"]),
    );
    const late = drawnWith(hud, inLair({}, { tick: 7_200 - 600 })).written;
    expect(
      late
        .filter((line) => line.text === "ROCKET 0:10")
        .map(({ fill }) => fill),
    ).toContain(colour.berry);
  });

  it("says what was just done for a while, and what to do next or dodge now", () => {
    const said = (kind: FoundKind, tick: number) =>
      drawnWith(hud, outside({}, { found: { kind, tick: 100 }, tick })).texts();
    for (const kind of Object.keys(doneWords) as FoundKind[])
      expect(said(kind, 150)).toContain(doneWords[kind]);
    expect(said("key", 220)).not.toContain(doneWords.key);
    const step = (state: WoodsState) => nextStep(state, baseOf(state));
    expect(step(outside())).toContain("FREE THE CAGED DRAGONS");
    expect(step(outside({ pieces: [true, true, true] }))).toContain(
      "GATE IS OPEN",
    );
    expect(step(inLair({}, { tick: waveFirst }))).toContain("SHOCKWAVE!");
    expect(
      step(inLair({}, { tick: laserEvery - laserOn - laserWarn })),
    ).toContain("LASER!");
    expect(step(inLair({}, { tick: 5 }))).toContain(
      "BREAK THE FACTORY'S 3 VALVES",
    );
    expect(step(inLair({ broken: [true, true, true] }, { tick: 5 }))).toContain(
      "THE SHIELD IS DOWN!",
    );
  });
});

describe("the scenes of the woods, and the woods on the screen", () => {
  it("close black bars, offer a skip, and give each line in turn to who says it, over their own picture when drawn flat", () => {
    const scene = (
      id: "launch" | "lair" | "peace" | "rise",
      share: number,
      layered = false,
    ) =>
      drawnWith(
        (context, state: WoodsState) => drawWoods(context, state, layered),
        outside(
          {},
          { scene: { id, start: 0 }, tick: Math.round(share * sceneTicks[id]) },
        ),
      );
    expect(scene("rise", 0).texts()).toEqual([]);
    expect(scene("rise", 0.1).texts()).toEqual(
      expect.arrayContaining([
        "SPACE OR USE: SKIP",
        "OUT OF THE MAZE, THE TREES OPEN UP...",
      ]),
    );
    expect(scene("rise", 0.3).texts()).toEqual(
      expect.arrayContaining(["SPARKY"]),
    );
    expect(scene("rise", 0.6).texts()).toEqual(
      expect.arrayContaining([
        "GLITCHY",
        "LOOK! DEFU'S OUTPOST, AND DRAGONS IN CAGES!",
      ]),
    );
    expect(scene("lair", 0.1).texts()).toContain("DEFU");
    expect(scene("peace", 0.9).texts()).toContain("GLITCHY");
    expect(scene("launch", 0.9).texts().join(" ")).toContain("TRY AGAIN!");
    for (const id of ["launch", "lair", "peace", "rise"] as const)
      expect(scene(id, 0.5).drawn.length).toBeGreaterThan(
        scene(id, 0.5, true).drawn.length + 100,
      );
  });

  it("are the maze until Glitchy is out, then the woods from above with their counts, and only the counts when drawn in three dimensions", () => {
    expect(drawnWith(drawWoods, maze).texts()).toContain(
      "CLUES 0/3  PARTS 0/4",
    );
    const out = outside({}, { tick: 400 });
    expect(drawnWith(drawWoods, out).texts()).toContain("KEYS 0/3");
    const layered = drawnWith(
      (context, state: WoodsState) => drawWoods(context, state, true),
      out,
    );
    expect(layered.texts()).toContain("KEYS 0/3");
    expect(layered.drawn.length).toBeLessThan(60);
  });
});
