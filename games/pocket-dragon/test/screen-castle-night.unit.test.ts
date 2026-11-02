import { describe, expect, it } from "vitest";

import { castleSounds } from "../src/feedback.ts";
import { phaseTicks } from "../src/rules/castle/constants.ts";
import { cage, gate } from "../src/rules/castle/places.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import type { CastleState } from "../src/rules/castle/types.ts";
import { drawCastle } from "../src/screen/castle-draw.ts";
import { guardKey } from "../src/screen/defu.ts";
import { colour } from "../src/screen/palette.ts";
import { surface } from "./support/canvas.ts";

const drawn = (state: CastleState) => {
  const screen = surface();
  drawCastle(screen.context, state);
  return screen;
};
const fills = (screen: ReturnType<typeof surface>) =>
  new Set(screen.drawn.map(({ fill }) => fill));
const near = (x: number, y: number, more: Partial<CastleState> = {}) => ({
  ...startCastle(3),
  friends: [true, true, true, true],
  x,
  y,
  ...more,
});

describe("the guild's land by night, in winter and indoors", () => {
  it("is dark at night but for Glitchy's light and the guards' lanterns, with the eggs, the guards and the cage cart", () => {
    const night = near(cage.x, cage.y + 2, {
      eggs: [
        { state: "loose", x: cage.x + 1, y: cage.y + 2 },
        { state: "caged", x: cage.x, y: cage.y },
        { state: "carried", x: cage.x - 2, y: cage.y + 2 },
      ],
      guards: [
        { carrying: 2, dizzy: 0, moved: 0, x: cage.x - 2, y: cage.y + 2 },
        { carrying: -1, dizzy: 30, moved: 0, x: cage.x + 2, y: cage.y + 1 },
      ],
      phase: "night",
      phaseTick: 0,
      tick: 20,
    });
    const screen = drawn(night);
    expect(screen.drawn.some(({ fill }) => fill.startsWith("rgb(8 6 40"))).toBe(
      true,
    );
    expect(fills(screen).has(guardKey.b ?? "")).toBe(true);
    expect(fills(screen).has(colour.woodDark)).toBe(true);
    expect(screen.texts()).toEqual(
      expect.arrayContaining(["NIGHT FALLS", "EGGS 0/3"]),
    );
    const later = drawn({ ...night, tick: phaseTicks + 10 });
    expect(later.texts()).not.toContain("NIGHT FALLS");
    const day = drawn(near(cage.x, cage.y + 2));
    expect(day.drawn.some(({ fill }) => fill.startsWith("rgb(8 6 40"))).toBe(
      false,
    );
    expect(day.texts()).toContain("CLUES 0/3");
  });

  it("is white with snow in winter, the river frozen, and the gate shut or open", () => {
    const winter = near(gate.x, gate.y + 2, {
      phase: "winter",
      phaseTick: 0,
      tick: 30,
    });
    const screen = drawn(winter);
    expect(fills(screen).has("#eef6ff")).toBe(true);
    expect(screen.texts()).toEqual(
      expect.arrayContaining([
        "WINTER COMES",
        "THE RIVER IS FROZEN: STORM THE CASTLE!",
      ]),
    );
    const ink = (state: CastleState) =>
      drawn(state).drawn.filter(({ fill }) => fill === colour.ink).length;
    expect(ink({ ...winter, gateOpen: true })).toBeLessThan(ink(winter));
    const river = drawn(near(10, 21, { phase: "winter" }));
    expect(fills(river).has("#bfe6ff")).toBe(true);
  });

  it("draws a house inside with its name, its chest and its clue, Glitchy's forcefield, and the guild's level and gear", () => {
    const room = drawn(
      near(5, 5, { gear: [true, false, false], room: 0, tick: 12 }),
    );
    expect(room.texts()).toEqual(
      expect.arrayContaining(["THE BAKERY", "GUILD LV 3"]),
    );
    expect(fills(room).has(colour.fire)).toBe(true);
    const library = drawn(near(5, 5, { clues: [false, true, false], room: 1 }));
    expect(library.texts()).toContain("THE LIBRARY");
    expect(drawn(near(5, 5, { room: 2 })).texts()).toContain("THE WATCHTOWER");
    const shielded = drawn(near(8, 25, { forcefield: 300 }));
    expect(fills(shielded).has(colour.cyan)).toBe(true);
    const geared = drawn(near(8, 25, { gear: [true, true, true] }));
    expect(fills(geared).has(colour.pink)).toBe(true);
  });

  it("is heard: the night, an egg saved, a bump, the gate opening and the guild going up a level", () => {
    const before = near(8, 25);
    const said = (id: string) =>
      castleSounds(before, { ...before, message: { id, tick: 1 } });
    expect(said("night")).toEqual(["stage"]);
    expect(said("egg-saved")).toEqual(["egg"]);
    expect(said("bumped")).toEqual(["hit"]);
    expect(said("gate-open")).toEqual(["gate"]);
    expect(said("gear-1")).toEqual(["chest"]);
    expect(
      castleSounds(before, { ...before, cheered: [true, true, true, true] }),
    ).toEqual(["levelup"]);
  });
});
