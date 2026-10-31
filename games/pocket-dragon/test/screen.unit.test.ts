import { describe, expect, it } from "vitest";

import { challenge, perform } from "../src/rules/castle/battle.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { maxTicks } from "../src/rules/woods/constants.ts";
import { cameraOf, drawCastle, glitchyAt } from "../src/screen/castle-draw.ts";
import { castleWords } from "../src/screen/castle-words.ts";
import { drawHills, hillsCamera } from "../src/screen/hills-draw.ts";
import { colour } from "../src/screen/palette.ts";
import { lines } from "../src/screen/text.ts";
import { drawWoods } from "../src/screen/woods-draw.ts";
import { surface } from "./support/canvas.ts";
import { flatHills } from "./support/hills-world.ts";

const drawnWith = <State>(
  draw: (context: CanvasRenderingContext2D, state: State) => void,
  state: State,
) => {
  const screen = surface();
  draw(screen.context, state);
  return screen;
};

describe("the screen of Egg Hills", () => {
  it("shows the stage, its name as it begins, and the fire key once Glitchy has fire", () => {
    const start = drawnWith(drawHills, startHills(3));
    expect(start.texts()).toEqual(
      expect.arrayContaining(["STAGE 1/3", "STAGE 1", "MEADOW MORNING"]),
    );
    expect(start.texts()).not.toContain("FIRE: F OR X");
    expect(start.drawn.length).toBeGreaterThan(200);
    const later = drawnWith(drawHills, {
      ...startHills(3),
      hasFire: true,
      stage: 3,
      tick: 400,
    });
    expect(later.texts()).toContain("FIRE: F OR X");
    expect(later.texts()).not.toContain("SUNSET RIDGE");
  });

  it("draws fire, cheered gloomlings, melted ice, the nest and the end of the chapter", () => {
    const busy = flatHills(
      {
        ice: [{ column: 5, row: 6 }],
        patrols: [{ maxX: 9 * 256, minX: 3 * 256, x: 4 * 256, y: 1632 }],
      },
      {
        checkpoint: true,
        fireballs: [{ life: 30, vx: 44, x: 700, y: 1600 }],
        hasFire: true,
        melted: [true],
        tick: 300,
      },
    );
    const count = (state: typeof busy, fill: string) =>
      drawnWith(drawHills, state).drawn.filter((block) => block.fill === fill)
        .length;
    expect(count(busy, colour.fire)).toBeGreaterThan(
      count({ ...busy, fireballs: [] }, colour.fire),
    );
    expect(count({ ...busy, melted: [false] }, colour.ice)).toBeGreaterThan(
      count(busy, colour.ice),
    );
    const cheered = {
      ...busy,
      glooms: [{ alive: false, cheered: 290, dir: 1 as const, x: 4 * 256 }],
    };
    expect(drawnWith(drawHills, cheered).drawn).not.toEqual(
      drawnWith(drawHills, busy).drawn,
    );
    expect(
      drawnWith(drawHills, { ...busy, finishTick: 300 }).texts(),
    ).toContain("EGG HILLS CLEARED!");
    expect(drawnWith(drawHills, { ...busy, over: true }).texts()).toContain(
      "OUT OF HEARTS",
    );
  });

  it("follows Glitchy, and never shows past either end of the stage", () => {
    const start = startHills(3);
    expect(hillsCamera(start)).toBe(0);
    const middle = { ...start, hero: { ...start.hero, x: 70 * 256 } };
    expect(hillsCamera(middle)).toBeGreaterThan(0);
    const end = { ...start, hero: { ...start.hero, x: 149 * 256 } };
    expect(hillsCamera(end)).toBe(150 * 16 - 256);
  });
});

describe("the screen of the Whispering Woods", () => {
  it("shows the clue count, the moonlight left and how to open the gate at first", () => {
    const start = drawnWith(drawWoods, startWoods(3));
    expect(start.texts()).toEqual(
      expect.arrayContaining([
        "CLUES 0/3",
        "MOONLIGHT 6:00",
        "FIND 3 CLUE STONES TO OPEN THE MOON GATE",
      ]),
    );
    expect(start.drawn.length).toBeGreaterThan(256);
    const late = drawnWith(drawWoods, {
      ...startWoods(3),
      tick: maxTicks - 61,
    });
    expect(late.texts()).toContain("MOONLIGHT 0:02");
  });

  it("says what was just found, that the gate is open after the last clue, and when Glitchy is out", () => {
    const start = startWoods(3);
    const say = (
      kind: "chest" | "clue" | "lantern" | "melt" | "moon",
      clues = [true, false, false],
    ) =>
      drawnWith(drawWoods, {
        ...start,
        breathTick: 499,
        clues,
        found: { kind, tick: 490 },
        tick: 500,
      }).texts();
    expect(say("chest")).toContain("TREASURE!");
    expect(say("lantern")).toContain("A LANTERN GLOWS");
    expect(say("melt")).toContain("THE FROZEN HEDGE MELTS");
    expect(say("moon")).toContain("THE MOON CHEST!");
    expect(say("clue", [true, true, true])).toContain("THE MOON GATE IS OPEN!");
    expect(drawnWith(drawWoods, { ...start, escaped: true }).texts()).toContain(
      "OUT OF THE WOODS!",
    );
  });
});

describe("the screen of the guild's chapter", () => {
  it("follows Glitchy across the map between steps, and keeps the camera on the map", () => {
    const start = startCastle(3);
    expect(glitchyAt(start)).toEqual({ x: start.x * 16, y: start.y * 16 });
    const stepping = {
      ...start,
      step: { from: { x: start.x - 1, y: start.y }, start: 0 },
      tick: 4,
    };
    expect(glitchyAt(stepping).x).toBeLessThan(start.x * 16);
    expect(cameraOf({ ...start, x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(cameraOf({ ...start, x: 39, y: 29 })).toEqual({
      x: 40 * 16 - 256,
      y: 30 * 16 - 144,
    });
  });

  it("shows what was said in a box, the challenge with its shows, and the banner raised", () => {
    const start = startCastle(3);
    const told = drawnWith(drawCastle, {
      ...start,
      message: { id: "wants-0", tick: 0 },
      tick: 5,
    });
    expect(told.texts().join(" ")).toContain("BOLT");
    expect(lines(castleWords["wants-0"] ?? "", 40).length).toBeGreaterThan(1);
    const asked = challenge({ ...start, friends: [true, true, true, true] }, 0);
    const menu = drawnWith(drawCastle, asked).texts();
    expect(menu).toEqual(
      expect.arrayContaining(["FIREWORKS", "GUILD SPIRIT", "GRUMBLE"]),
    );
    const shown = drawnWith(drawCastle, {
      ...perform(asked),
      tick: asked.tick + 10,
    });
    expect(shown.drawn.length).toBeGreaterThan(menu.length);
    const replied = {
      ...asked,
      battle: asked.battle && { ...asked.battle, lastReply: 2 },
    };
    expect(drawnWith(drawCastle, replied).texts()).toContain(
      "THE KEEPER GRUMBLED: -2 SPIRIT",
    );
    const raised = drawnWith(drawCastle, {
      ...start,
      bannerRaised: true,
      fireTick: 0,
      tick: 5,
    });
    expect(raised.texts()).toContain("THE CASTLE IS CAPTURED!");
  });
});
