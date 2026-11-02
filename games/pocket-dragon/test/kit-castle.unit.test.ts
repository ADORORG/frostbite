import { describe, expect, it } from "vitest";

import { emptyPack, startPowers, type Pack } from "../src/rules/kit.ts";
import { challenge } from "../src/rules/castle/battle.ts";
import {
  blastDizzy,
  dizzyTicks,
  guardStep,
  invulnerableTicks as castleBlink,
} from "../src/rules/castle/constants.ts";
import { castleRules } from "../src/rules/castle/index.ts";
import { cage, kitSpots } from "../src/rules/castle/places.ts";
import { takeKit } from "../src/rules/castle/powers.ts";
import { startCastle, tickCastle } from "../src/rules/castle/tick.ts";
import type {
  CastleControl,
  CastleState,
  NightGuard,
} from "../src/rules/castle/types.ts";
import { shiftTicks } from "../src/rules/quest/constants.ts";
import { readKeys } from "../src/rules/quest/keys.ts";
import { legKinds, legKit, legRun, legShown } from "../src/rules/quest/legs.ts";
import {
  advanceQuest,
  startQuest,
  tickQuest,
} from "../src/rules/quest/tick.ts";

const packed = (more: Partial<Pack>) =>
  startPowers({ big: false, pack: { ...emptyPack, ...more } });

const castleAt = (x: number, y: number, more: Partial<CastleState> = {}) => ({
  ...startCastle(3),
  x,
  y,
  ...more,
});
const nightGuard = (x: number, y: number, more: Partial<NightGuard> = {}) => ({
  carrying: -1,
  dizzy: 0,
  moved: 10_000,
  x,
  y,
  ...more,
});
const night = (x: number, y: number, more: Partial<CastleState>) =>
  castleAt(x, y, {
    eggs: [{ state: "caged" as const, ...cage }],
    friends: [true, true, true, true],
    phase: "night",
    ...more,
  });
const castlePress = (state: CastleState, control: CastleControl) => {
  const stepped = castleRules.step(state, {
    data: { on: 1, tick: state.tick },
    type: control,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};
const castlePlay = (state: CastleState, ticks: number): CastleState => {
  let now = state;
  for (let at = 0; at < ticks; at += 1) now = tickCastle(now);
  return now;
};

describe("the backpack in the guild's land", () => {
  it("picks up a food by stepping onto it, outdoors only", () => {
    const [berry] = kitSpots;
    if (berry === undefined) throw new Error("no food on the map");
    const took = takeKit(castleAt(berry.x, berry.y));
    expect(took.powers.pack.berry).toBe(1);
    expect(took.kitTaken).toEqual([true, false, false]);
    expect(takeKit(took)).toBe(took);
    const inside = castleAt(berry.x, berry.y, { room: 0 });
    expect(takeKit(inside)).toBe(inside);
    const walked = castlePlay(
      castlePress(castleAt(berry.x, berry.y + 1, { facing: "up" }), "up"),
      20,
    );
    expect(walked.powers.pack.berry).toBe(1);
  });

  it("sends fire two tiles farther in a berry's blaze", () => {
    const state = night(10, 26, {
      facing: "right",
      guards: [nightGuard(13, 26)],
    });
    expect(castlePress(state, "fire").guards[0]?.dizzy).toBe(0);
    const blazing = castlePress(
      castlePress({ ...state, powers: packed({ berry: 1 }) }, "berry"),
      "fire",
    );
    expect(blazing.guards[0]?.dizzy).toBe(dizzyTicks);
  });

  it("rolls a glitch blast through the guards, leaving each dizzy a long while, and stops at a tree", () => {
    const state = castlePress(
      night(10, 26, {
        facing: "right",
        guards: [nightGuard(12, 26), nightGuard(15, 26)],
        powers: packed({ mushroom: 1 }),
      }),
      "mushroom",
    );
    expect(state.blast).not.toBeNull();
    expect(state.powers.pack.mushroom).toBe(0);
    const rolled = castlePlay(state, 18);
    expect(rolled.guards.map((guard) => guard.dizzy > dizzyTicks)).toEqual([
      true,
      true,
    ]);
    expect(rolled.stuns).toBe(2);
    expect(castlePlay(rolled, 40).blast).toBeNull();
    expect(blastDizzy).toBeGreaterThan(dizzyTicks);
  });

  it("melts the ice around Bloom's seeds on its way and rolls on", () => {
    const state = castlePress(
      castleAt(7, 17, { facing: "right", powers: packed({ mushroom: 1 }) }),
      "mushroom",
    );
    const melted = castlePlay(state, 7);
    expect(melted.melted).toBe(true);
    expect(melted.blast?.x).toBe(9);
  });

  it("keeps the mushroom in the backpack indoors and in a cheer challenge", () => {
    const indoors = castleAt(5, 5, {
      powers: packed({ mushroom: 1 }),
      room: 0,
    });
    expect(castlePress(indoors, "mushroom").powers.pack.mushroom).toBe(1);
    const busy = challenge(
      castleAt(19, 11, { powers: packed({ mushroom: 1, pineapple: 1 }) }),
      0,
    );
    expect(busy.battle).not.toBeNull();
    expect(castlePress(busy, "mushroom").powers).toBe(busy.powers);
    expect(castlePress(busy, "pineapple").powers).toBe(busy.powers);
  });

  it("only shrinks a big Glitchy when a guard bumps it", () => {
    const state = night(4, 17, {
      guards: [nightGuard(5, 17, { moved: -guardStep })],
      powers: { ...startPowers(), big: true },
    });
    const bumped = castlePlay(state, 1);
    expect(bumped.hearts).toBe(state.hearts);
    expect(bumped.heartsLost).toBe(0);
    expect(bumped.powers.big).toBe(false);
    expect(bumped.invulnerable).toBe(castleBlink);
    expect(bumped.message?.id).toBe("shrank");
  });
});

describe("the backpack in the quest", () => {
  it("goes on with Glitchy (and Glitchy's size) into the next level", () => {
    const quest = startQuest(5);
    const shown = legShown(quest.leg);
    if (shown.id !== "hills") throw new Error("the quest begins in the hills");
    const kit = { big: true, pack: { ...emptyPack, mushroom: 2 } };
    const leg = legRun(legKinds.hills, {
      ...shown.state,
      finishTick: 0,
      powers: startPowers(kit),
    });
    expect(legKit(leg)).toEqual(kit);
    const shifting = tickQuest({ ...quest, leg });
    const arrived = advanceQuest(shifting, shifting.tick + shiftTicks);
    const castle = legShown(arrived.leg);
    expect(castle.id).toBe("castle");
    expect(castle.id === "castle" && castle.state.powers.pack).toEqual(
      kit.pack,
    );
    expect(castle.id === "castle" && castle.state.powers.big).toBe(true);
  });

  it("writes the foods' keys compactly", () => {
    expect(readKeys("3B2b4M1m2G0g")).toEqual([
      { control: "berry", gap: 3, on: true },
      { control: "berry", gap: 2, on: false },
      { control: "mushroom", gap: 4, on: true },
      { control: "mushroom", gap: 1, on: false },
      { control: "pineapple", gap: 2, on: true },
      { control: "pineapple", gap: 0, on: false },
    ]);
  });
});
