import { describe, expect, it } from "vitest";

import { hillsSounds } from "../src/feedback.ts";
import {
  flapSpeed,
  groundRow,
  skyStart,
  springHeight,
  tile,
  tunnelStart,
  ventEvery,
} from "../src/rules/hills/constants.ts";
import { startHero } from "../src/rules/hills/state.ts";
import type { HillsState } from "../src/rules/hills/types.ts";
import { drawHills, hillsCamera } from "../src/screen/hills-draw.ts";
import { colour } from "../src/screen/palette.ts";
import { surface } from "./support/canvas.ts";
import { flatHills } from "./support/hills-world.ts";

const drawn = (state: HillsState) => {
  const screen = surface();
  drawHills(screen.context, state);
  return screen;
};
const fills = (screen: ReturnType<typeof surface>) =>
  new Set(screen.drawn.map(({ fill }) => fill));
const at = (x: number, more: Partial<HillsState> = {}) =>
  flatHills(
    {
      burrow: { x: 21 * tile, y: groundRow * tile },
      cloudGate: { x: 30 * tile, y: tile },
      forcefield: { x: 26 * tile, y: 6 * tile },
      rollers: [
        { maxX: 30 * tile, minX: 24 * tile, phase: 0, y: 7 * tile - 224 },
      ],
      secrets: true,
      springs: [{ x: 30 * tile, y: groundRow * tile - springHeight }],
      vents: [{ phase: 0, x: 23 * tile, y: groundRow * tile }],
      wings: { x: 22 * tile, y: 6 * tile },
    },
    { hero: { ...startHero(), x }, ...more },
  );

describe("the secret areas on the screen", () => {
  it("draw the tunnel as a cave of glowing crystals and the sky as cloud steps, each named, with the camera kept inside", () => {
    const tunnel = at((tunnelStart + 2) * tile);
    const cave = drawn(tunnel);
    expect(cave.texts()).toContain("SECRET TUNNEL");
    expect(cave.stops).toContain("#1b0f33");
    expect(fills(cave).has(colour.stone)).toBe(true);
    expect(hillsCamera(tunnel)).toBe(tunnelStart * 16);
    const sky = drawn(at((skyStart + 2) * tile));
    expect(sky.texts()).toContain("SKY ISLANDS");
    expect(sky.stops).toContain("#7fd2ff");
    expect(fills(sky).has("#d6ecff")).toBe(true);
    expect(drawn(at(20 * tile)).texts()).not.toContain("SECRET TUNNEL");
  });

  it("show the new things of a stage: a spring, steam while a vent puffs, a boulder, the wings and the bubble, and the burrow only up close", () => {
    const near = drawn(at(21 * tile, { tick: ventEvery }));
    expect(fills(near).has(colour.berry)).toBe(true);
    expect(fills(near).has(colour.cloud)).toBe(true);
    expect(fills(near).has(colour.stone)).toBe(true);
    expect(fills(near).has(colour.cyan)).toBe(true);
    expect(near.texts()).toContain("DOWN");
    const far = drawn(at(2 * tile, { tick: 60 }));
    expect(far.texts()).not.toContain("DOWN");
    expect(
      far.drawn.filter(({ fill }) => fill === colour.ink).length,
    ).toBeLessThan(near.drawn.filter(({ fill }) => fill === colour.ink).length);
  });

  it("put the wings and the forcefield on Glitchy, with bars for the time they have left", () => {
    const plain = drawn(at(20 * tile, { forceTaken: true, wingsTaken: true }));
    const geared = drawn(
      at(20 * tile, {
        forceTaken: true,
        forcefield: 300,
        tick: 7,
        wings: 300,
        wingsTaken: true,
      }),
    );
    const bar = (screen: ReturnType<typeof surface>, fill: string) =>
      screen.drawn.filter(
        (block) => block.fill === fill && block.x === 5 && block.height === 2,
      );
    expect(bar(geared, colour.white)).toHaveLength(1);
    expect(bar(geared, colour.cyan)).toHaveLength(1);
    expect(bar(plain, colour.white)).toHaveLength(0);
    expect(geared.drawn.length).toBeGreaterThan(plain.drawn.length);
  });

  it("are heard: a spring, a flap, the wings, the forcefield, a secret found and a door through", () => {
    const before = at(20 * tile);
    expect(
      hillsSounds(before, {
        ...before,
        forceTaken: true,
        hero: { ...before.hero, sprung: true, vy: -flapSpeed },
        secretsFound: 1,
        wings: 600,
        wingsTaken: true,
      }),
    ).toEqual(["spring", "flap", "wings", "shield", "secret"]);
    expect(
      hillsSounds(before, {
        ...before,
        hero: { ...before.hero, x: (skyStart + 1) * tile },
      }),
    ).toEqual(["whoosh"]);
  });
});
