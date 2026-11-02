import { describe, expect, it } from "vitest";

import {
  bumpDizzy,
  dizzyTicks,
  forceTicks,
  guardStep,
  invulnerableTicks,
  levelAt,
  spiritMax,
  stepTicks,
  swiftStep,
} from "../src/rules/castle/constants.ts";
import {
  guildLevel,
  levelOf,
  showBonus,
  spiritOf,
  stepOf,
  xpOf,
} from "../src/rules/castle/guild.ts";
import { castleChapter } from "../src/rules/castle/index.ts";
import { nightFalls, stepToward } from "../src/rules/castle/night.ts";
import {
  bubble,
  cage,
  doors,
  gate,
  guardStarts,
  nightEggs,
} from "../src/rules/castle/places.ts";
import { inside, roomTile } from "../src/rules/castle/rooms.ts";
import {
  pressCastle,
  startCastle,
  tickCastle,
} from "../src/rules/castle/tick.ts";
import type {
  CastleState,
  NightEgg,
  NightGuard,
} from "../src/rules/castle/types.ts";
import { walkable } from "../src/rules/castle/world.ts";

const all = [true, true, true, true];
const at = (x: number, y: number, more: Partial<CastleState> = {}) => ({
  ...startCastle(3),
  x,
  y,
  ...more,
});
// A way pressed and held, as the chapter takes it.
const hold = (state: CastleState, way: "left" | "right"): CastleState =>
  pressCastle({ ...state, controls: { ...state.controls, [way]: true } }, way);
const play = (state: CastleState, ticks: number): CastleState => {
  let now = state;
  for (let tick = 0; tick < ticks; tick += 1) now = tickCastle(now);
  return now;
};
const egg = (x: number, y: number, state: NightEgg["state"] = "loose") => ({
  state,
  x,
  y,
});
const guard = (x: number, y: number, more: Partial<NightGuard> = {}) => ({
  carrying: -1,
  dizzy: 0,
  moved: -guardStep,
  x,
  y,
  ...more,
});
// The night on an open meadow (rows 15 to 19), with just the guards and eggs a test names (and, so that the night goes on, an egg
// in the cage unless the test says otherwise).
const night = (more: Partial<CastleState>) =>
  at(4, 17, {
    eggs: [egg(cage.x, cage.y, "caged")],
    friends: all,
    lilies: true,
    opened: [true, true],
    phase: "night",
    ...more,
  });

describe("the houses", () => {
  it("are entered by bumping the door, hold a chest of gear and a clue, and are left by the door", () => {
    const door = doors[0] ?? { x: 0, y: 0 };
    const inBakery = pressCastle(at(door.x, door.y + 1), "up");
    expect(inBakery).toMatchObject({ room: 0, x: inside.x, y: inside.y });
    expect(inBakery.message?.id).toBe("room-0");
    expect(roomTile(0, 9, 3)).toBe("C");
    expect(walkable(inBakery, 9, 3)).toBe(false);
    expect(walkable(inBakery, 9, 4)).toBe(true);
    const chest = pressCastle({ ...inBakery, facing: "up", x: 9, y: 4 }, "act");
    expect(chest.gear).toEqual([true, false, false]);
    expect(chest.message?.id).toBe("gear-0");
    expect(pressCastle(chest, "act").message?.id).toBe("chest-empty");
    const clue = pressCastle({ ...chest, facing: "left", x: 2, y: 5 }, "act");
    expect(clue.clues).toEqual([true, false, false]);
    expect(pressCastle(clue, "fire").fireTick).toBe(clue.tick);
    const out = pressCastle({ ...clue, x: inside.x, y: inside.y }, "down");
    expect(out).toMatchObject({ room: -1, x: door.x, y: door.y + 1 });
    expect(pressCastle({ ...inBakery, room: 7 }, "act")).toEqual({
      ...inBakery,
      room: 7,
    });
  });
});

describe("the night", () => {
  it("falls once the guild is whole, bringing the eggs and the guards, and gives way to winter once every egg is saved", () => {
    const day = at(30, 20, { friends: all });
    const fallen = tickCastle(day);
    expect(fallen.phase).toBe("night");
    expect(fallen.eggs).toHaveLength(nightEggs.length);
    expect(fallen.guards.map(({ x, y }) => ({ x, y }))).toEqual(guardStarts);
    expect(fallen.message?.id).toBe("night");
    const saved = {
      ...fallen,
      eggs: fallen.eggs.map((one) => ({ ...one, state: "saved" as const })),
    };
    const winter = nightFalls(saved);
    expect(winter).toMatchObject({ guards: [], phase: "winter" });
    expect(nightFalls(winter)).toBe(winter);
  });

  it("sends each guard along the shortest way to the nearest loose egg, then with it to the cage", () => {
    expect(
      stepToward(
        { x: 1, y: 1 },
        (x, y) => x === 3 && y === 1,
        () => true,
      ),
    ).toEqual({ x: 2, y: 1 });
    expect(
      stepToward(
        { x: 1, y: 1 },
        (x, y) => x === 3 && y === 1,
        () => false,
      ),
    ).toBeNull();
    const chasing = night({
      eggs: [egg(10, 17)],
      guards: [guard(13, 17)],
    });
    const stepped = play(chasing, 1);
    expect(stepped.guards[0]).toMatchObject({ x: 12, y: 17 });
    const taken = play(stepped, guardStep * 2);
    expect(taken.guards[0]).toMatchObject({ carrying: 0, x: 10, y: 17 });
    expect(taken.eggs[0]?.state).toBe("carried");
    const nearCage = night({
      eggs: [egg(cage.x, cage.y + 2, "carried")],
      guards: [guard(cage.x, cage.y + 2, { carrying: 0 })],
      x: 30,
      y: 17,
    });
    const caged = play(nearCage, guardStep * 2);
    expect(caged.eggs[0]?.state).toBe("caged");
    expect(caged.guards[0]?.carrying).toBe(-1);
    const opened = pressCastle(
      { ...caged, facing: "up", guards: [], x: cage.x, y: cage.y + 1 },
      "act",
    );
    expect(opened.eggs[0]?.state).toBe("saved");
    expect(pressCastle(opened, "act").message?.id).toBe("cage-empty");
  });

  it("leaves a guard puffed with fire dizzy, dropping what it carries, and saves an egg walked onto", () => {
    const thief = night({
      eggs: [egg(5, 17, "carried")],
      facing: "right",
      guards: [guard(5, 17, { carrying: 0 })],
    });
    const puffed = pressCastle(thief, "fire");
    expect(puffed.guards[0]).toMatchObject({ carrying: -1, dizzy: dizzyTicks });
    expect(puffed.eggs[0]).toEqual(egg(5, 17));
    expect(puffed.stuns).toBe(1);
    expect(pressCastle({ ...puffed, guards: [] }, "fire")).toMatchObject({
      fireTick: puffed.fireTick,
    });
    expect(play(puffed, guardStep * 3).guards[0]).toMatchObject({
      x: 5,
      y: 17,
    });
    const far = night({
      facing: "right",
      gear: [false, false, true],
      guards: [guard(13, 16)],
      x: 10,
      y: 16,
    });
    expect(pressCastle(far, "fire").guards[0]?.dizzy).toBe(dizzyTicks);
    const walked = play(
      hold({ ...puffed, guards: [] }, "right"),
      stepTicks + 1,
    );
    expect(walked.eggs[0]?.state).toBe("saved");
    expect(walked.message?.id).toBe("egg-saved");
  });

  it("costs a heart when a guard bumps Glitchy, but not while Glitchy blinks or has the forcefield", () => {
    const chased = night({ guards: [guard(5, 17)] });
    const bumped = play(chased, 1);
    expect(bumped).toMatchObject({
      hearts: 2,
      heartsLost: 1,
      invulnerable: invulnerableTicks,
    });
    expect(bumped.guards[0]?.dizzy).toBe(bumpDizzy);
    const shielded = play({ ...chased, forcefield: 300 }, 1);
    expect(shielded.hearts).toBe(3);
    expect(shielded.message?.id).toBe("shrugged");
    const bubbled = play(night({ x: bubble.x - 1, y: bubble.y }), 0);
    const taken = play(hold(bubbled, "right"), stepTicks + 1);
    expect(taken).toMatchObject({ forceTaken: true });
    expect(taken.forcefield).toBeGreaterThan(forceTicks - stepTicks - 2);
    const out = { ...chased, hearts: 1 };
    const lost = play(out, 1);
    expect(lost.hearts).toBe(0);
    expect(castleChapter.done(lost)).toBe(true);
    // With no hearts left, the guards stop and only the clock goes on.
    expect(tickCastle(lost)).toMatchObject({
      guards: lost.guards,
      hearts: 0,
      tick: lost.tick + 1,
    });
  });
});

describe("the winter and the guild", () => {
  it("freezes the river, and opens the gate only in winter, to all three clues", () => {
    const river = at(10, 21, { friends: all });
    expect(walkable(river, 10, 20)).toBe(false);
    expect(walkable({ ...river, phase: "winter" }, 10, 20)).toBe(true);
    const below = at(gate.x, gate.y + 1, { facing: "up" });
    expect(pressCastle(below, "act").message?.id).toBe("gate-shut");
    const winter = { ...below, phase: "winter" as const };
    expect(pressCastle(winter, "act").message?.id).toBe("gate-clues");
    const open = pressCastle({ ...winter, clues: [true, true, true] }, "act");
    expect(open).toMatchObject({ gateOpen: true });
    expect(walkable(open, gate.x, gate.y)).toBe(true);
  });

  it("grows by experience into levels that give spirit and stronger shows, and walks faster in the swift boots", () => {
    const fresh = startCastle(3);
    expect([xpOf(fresh), guildLevel(fresh), spiritOf(fresh)]).toEqual([
      0,
      1,
      spiritMax,
    ]);
    expect(levelOf(levelAt[4])).toBe(5);
    expect(levelOf(99_999)).toBe(levelAt.length);
    const busy = {
      ...fresh,
      cheered: [true, true, true, true],
      clues: [true, true, true],
      friends: all,
      gear: [true, true, true],
      stuns: 5,
    };
    expect(xpOf(busy)).toBe(400 + 240 + 180 + 600 + 100);
    expect(guildLevel(busy)).toBe(5);
    expect(showBonus(busy)).toBe(2);
    expect(spiritOf(busy)).toBe(spiritMax + 4);
    expect(stepOf(busy)).toBe(swiftStep);
    expect(stepOf(fresh)).toBe(stepTicks);
    const swift = play(
      hold(at(8, 25, { gear: [true, false, false] }), "right"),
      swiftStep + 1,
    );
    expect(swift.x).toBe(9);
  });
});
