import { describe, expect, it } from "vitest";

import { startBoss } from "../src/rules/hills/boss.ts";
import { arenaX, gustTicks, tile } from "../src/rules/hills/constants.ts";
import { startHills } from "../src/rules/hills/state.ts";
import type {
  Boss,
  Ghost,
  HillsState,
  Weather,
} from "../src/rules/hills/types.ts";
import { drawHills } from "../src/screen/hills-draw.ts";
import { count, drawnWith, sound } from "./support/drawn.ts";

const hills = (state: HillsState) => drawnWith(drawHills, state).texts();
const seal = "#2ed8c3";
const laser = "#ff5f6d";

// Glitchy in the arena on `stage`, the fight begun at tick 100, now at `tick`.
function inArena(
  stage: number,
  tick: number,
  boss: Partial<Boss> = {},
): HillsState {
  const start = startHills(4);
  return {
    ...start,
    boss: { ...startBoss(4, stage), started: 100, ...boss },
    hero: { ...start.hero, x: arenaX + 4 * tile },
    stage,
    tick,
  };
}

describe("the boss fight on the screen", () => {
  it("is not drawn far from the arena, and shows the portal sealed and DeFu on her ledge as Glitchy comes", () => {
    expect(count(drawHills, startHills(4), seal)).toBe(0);
    const coming = {
      ...startHills(4),
      hero: { ...startHills(4).hero, x: arenaX + 4 * tile },
      tick: 50,
    };
    expect(count(drawHills, coming, seal)).toBeGreaterThan(5);
    expect(hills(coming)).not.toContain("DEFU!");
  });

  it("names her as the fight begins and counts what is left to beat, calling out the rocket on the last stage", () => {
    expect(hills(inArena(1, 110))).toEqual(
      expect.arrayContaining(["DEFU!", "SEALED: 1 TO GO"]),
    );
    expect(hills(inArena(1, 300))).not.toContain("DEFU!");
    expect(hills(inArena(1, 300))).not.toContain(
      "FREE THE EGGS FROM THE ROCKET!",
    );
    expect(hills(inArena(3, 300))).toEqual(
      expect.arrayContaining([
        "SEALED: 3 TO GO",
        "FREE THE EGGS FROM THE ROCKET!",
      ]),
    );
    const burst = inArena(3, 300);
    const done = {
      ...burst,
      boss: {
        ...burst.boss,
        rocket: { dir: 1 as const, hp: 0, hurt: 0, x: arenaX },
      },
    };
    expect(hills(done)).toContain("SEALED: 2 TO GO");
    expect(hills(done)).not.toContain("FREE THE EGGS FROM THE ROCKET!");
  });

  it("marks a strike's spots and flashes her eyes red as a warning, then brings the beams down", () => {
    const strike = { marks: [arenaX + 6 * tile], start: 290 };
    expect(
      count(drawHills, inArena(2, 300, { strike }), "#ff2a3a"),
    ).toBeGreaterThan(count(drawHills, inArena(2, 300), "#ff2a3a"));
    expect(
      count(drawHills, inArena(2, 304, { strike }), "#ff2a3a"),
    ).toBeGreaterThan(0);
    expect(count(drawHills, inArena(2, 300, { strike }), laser)).toBe(0);
    expect(count(drawHills, inArena(2, 341, { strike }), laser)).toBe(21);
    expect(
      count(
        drawHills,
        inArena(3, 345, {
          strike: {
            marks: [1, 2, 3].map((at) => arenaX + at * 3 * tile),
            start: 300,
          },
        }),
        laser,
      ),
    ).toBe(63);
  });

  it("draws ghost dragons with their hits left, blinking when hit and sparkling away when freed, guards each way and the rocket", () => {
    const three = inArena(3, 300);
    const [first, second] = three.boss.ghosts;
    if (first === undefined || second === undefined)
      throw new Error("two ghosts");
    const blocks = (tick: number, ghosts: readonly Ghost[]) =>
      drawnWith(drawHills, inArena(3, tick, { ghosts })).drawn.length;
    const freed = { ...second, freed: 300, hp: 0 };
    expect(blocks(330, [first, freed]) - blocks(330, [first])).toBe(6);
    expect(blocks(361, [first, freed])).toBe(blocks(361, [first]));
    expect(
      blocks(330, [first, second]) - blocks(330, [first, { ...second, hp: 1 }]),
    ).toBe(2);
    const states = [0, 1, 2, 3, 30, 59, 61].flatMap((since) => [
      inArena(3, 300 + since, {
        freed: [
          { caught: false, vx: 4, vy: -20, x: arenaX + tile, y: 1600 },
          { caught: true, vx: 0, vy: 0, x: arenaX, y: 1664 },
        ],
        ghosts: [
          { ...first, hurt: 10 },
          { ...second, freed: 300, hp: 0 },
        ],
        guards: [
          { dir: -1, x: arenaX + 8 * tile },
          { dir: 1, x: arenaX + 3 * tile },
        ],
        rocket: {
          dir: -1,
          hp: 4,
          hurt: since % 2 === 0 ? 5 : 0,
          x: arenaX + 6 * tile,
        },
      }),
    ]);
    expect(sound(drawHills, states)).toBe(true);
    expect(drawnWith(drawHills, states[0] ?? three).drawn).not.toEqual(
      drawnWith(drawHills, states[1] ?? three).drawn,
    );
  });

  it("says the portal is open once the fight is won, while DeFu flies off, promising to be back", () => {
    const won = inArena(1, 300, { beaten: 250, ghosts: [] });
    expect(hills(won)).toEqual(
      expect.arrayContaining([
        "I'LL BE BACK, LITTLE DRAGON!",
        "THE PORTAL IS OPEN!",
      ]),
    );
    expect(hills(won).some((text) => text.startsWith("SEALED"))).toBe(false);
    const later = inArena(1, 400, { beaten: 250, ghosts: [] });
    expect(hills(later)).not.toContain("THE PORTAL IS OPEN!");
    expect(hills(later)).not.toContain("I'LL BE BACK, LITTLE DRAGON!");
    expect(count(drawHills, later, seal)).toBe(0);
  });
});

describe("Egg Hills' weather, metaplasma and charms on the screen", () => {
  const weathered = (weather: Weather, tick: number): HillsState => {
    const start = startHills(4);
    return { ...start, level: { ...start.level, weather }, tick };
  };

  it("blows streaks across in a gust of wind, rains, and hides all but what is near Glitchy in fog", () => {
    const streaks = (state: HillsState) =>
      drawnWith(drawHills, state).drawn.filter(
        (block) => block.width === 9 && block.height === 1,
      ).length;
    expect(streaks(weathered("wind", 4 * gustTicks))).toBe(16);
    expect(streaks(weathered("wind", gustTicks))).toBe(0);
    expect(count(drawHills, weathered("rain", 10), "#9fd3ff")).toBe(96);
    expect(count(drawHills, weathered("fog", 10), "#d9d4ee")).toBe(64);
  });

  it("shows the metaplasma gathered, drifting motes, the charms held, and a secret charm when Glitchy is close", () => {
    const start = startHills(4);
    const busy = {
      ...start,
      feather: true,
      magnet: true,
      plasma: { ...start.plasma, drifting: [{ x: 700, y: 1500 }], gathered: 2 },
      plasmaBanked: 10,
      shield: true,
    };
    expect(hills(busy)).toContain("PLASMA 12");
    expect(drawnWith(drawHills, busy).drawn.length).toBeGreaterThan(
      drawnWith(drawHills, start).drawn.length,
    );
    const { charm } = start.level;
    const near = { ...start, hero: { ...start.hero, x: charm.x - 2 * tile } };
    expect(drawnWith(drawHills, near).drawn.length).toBeGreaterThan(
      drawnWith(drawHills, { ...near, charmTaken: true }).drawn.length,
    );
    expect(
      sound(
        drawHills,
        [0, 5, 60, 119, 121].map((tick) => ({ ...near, tick })),
      ),
    ).toBe(true);
  });
});
