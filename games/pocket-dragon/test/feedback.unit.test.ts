import { describe, expect, it } from "vitest";

import { castleSounds, hillsSounds, woodsSounds } from "../src/feedback.ts";
import {
  act,
  challenge,
  evadeMove,
  quickMove,
  reply,
} from "../src/rules/castle/battle.ts";
import { showTicks } from "../src/rules/castle/constants.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { startBoss } from "../src/rules/hills/boss.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { startBase } from "../src/rules/woods/base.ts";
import {
  laserEvery,
  laserOn,
  laserWarn,
  waveFirst,
  waveWarn,
} from "../src/rules/woods/constants.ts";
import { playScene } from "../src/rules/woods/scenes.ts";
import type { Base, WoodsState } from "../src/rules/woods/types.ts";

describe("what is heard", () => {
  it("in Egg Hills: a jump, a breath, an egg, the golden egg, the berry, a charm, melting, a cheer, a bump, a stage and metaplasma", () => {
    const before = startHills(1);
    const jumped = {
      ...before,
      hero: { ...before.hero, grounded: false, vy: -70 },
    };
    expect(hillsSounds(before, jumped)).toEqual(["jump"]);
    const busy = {
      ...before,
      berryTaken: true,
      breaths: 1,
      charms: 1,
      cheers: 1,
      eggsBanked: 1,
      goldens: 1,
      hasFire: true,
      heartsLost: 1,
      meltedCount: 3,
      plasmaBanked: 5,
      stagesCleared: 1,
    };
    expect(hillsSounds(before, busy)).toEqual([
      "fire",
      "egg",
      "golden",
      "berry",
      "charm",
      "melt",
      "cheer",
      "hit",
      "stage",
      "plasma",
    ]);
    expect(
      hillsSounds(before, { ...before, finishTick: 9, stagesCleared: 1 }),
    ).toEqual(["finish"]);
    expect(hillsSounds(before, before)).toEqual([]);
  });

  it("in the boss fight: red eyes, the lasers, a hit, a ghost dragon set free, the rocket bursting, a guard, the portal opening", () => {
    const fight = {
      ...startHills(1),
      boss: { ...startBoss(1, 3), started: 0 },
      stage: 3,
      tick: 10,
    };
    const warned = {
      ...fight,
      boss: { ...fight.boss, strike: { marks: [0], start: 10 } },
    };
    expect(hillsSounds(fight, warned)).toEqual(["warning"]);
    const firing = { ...warned, tick: 52 };
    expect(hillsSounds({ ...warned, tick: 51 }, firing)).toEqual(["laser"]);
    const [ghost] = fight.boss.ghosts;
    if (ghost === undefined || fight.boss.rocket === null)
      throw new Error("no fight");
    const hit = {
      ...fight,
      boss: {
        ...fight.boss,
        ghosts: [{ ...ghost, hp: 2 }, ...fight.boss.ghosts.slice(1)],
      },
    };
    expect(hillsSounds(fight, hit)).toEqual(["ghost"]);
    const freed = {
      ...fight,
      boss: {
        ...fight.boss,
        ghosts: [{ ...ghost, freed: 10, hp: 0 }, ...fight.boss.ghosts.slice(1)],
      },
    };
    expect(hillsSounds(fight, freed)).toEqual(["ghost", "freed"]);
    const burst = {
      ...fight,
      boss: { ...fight.boss, rocket: { ...fight.boss.rocket, hp: 0 } },
    };
    expect(hillsSounds(fight, burst)).toEqual(["ghost", "burst"]);
    expect(hillsSounds(fight, { ...fight, guardsCheered: 1 })).toEqual([
      "guard",
    ]);
    expect(
      hillsSounds(fight, { ...fight, boss: { ...fight.boss, beaten: 10 } }),
    ).toEqual(["gate"]);
  });

  it("in the woods: a breath, melting, a lantern, a clue (and the gate on the last), a chest, a part, the launcher, an egg, a charm, the way out", () => {
    const before = startWoods(1);
    const after = {
      ...before,
      breaths: 1,
      chests: [true, false, false, false, false],
      clues: [true, false, false],
      lanterns: [true, false, false],
      melted: true,
    };
    expect(woodsSounds(before, after)).toEqual([
      "fire",
      "melt",
      "lantern",
      "clue",
      "chest",
    ]);
    expect(
      woodsSounds(
        { ...before, clues: [true, true, false] },
        { ...before, clues: [true, true, true] },
      ),
    ).toEqual(["gate"]);
    expect(woodsSounds(before, { ...before, moonChest: true })).toEqual([
      "chest",
    ]);
    expect(
      woodsSounds(before, { ...before, parts: [true, false, false, false] }),
    ).toEqual(["chest"]);
    expect(
      woodsSounds(before, { ...before, parts: [true, true, true, true] }),
    ).toEqual(["gate"]);
    expect(
      woodsSounds(before, { ...before, eggs: before.eggs.map(() => true) }),
    ).toEqual(["egg"]);
    expect(
      woodsSounds(before, { ...before, charms: [false, true, false] }),
    ).toEqual(["charm"]);
    expect(woodsSounds(before, { ...before, escaped: true })).toEqual([
      "finish",
    ]);
  });

  it("outside the maze: the scenes, a dragon freed, a key found and fitted, a guard dizzy or sent home, a shadow dragon hatched or freed, a valve, an egg, a bump and the pickups", () => {
    const maze = startWoods(1);
    const out = { ...maze, base: startBase(maze), escaped: true };
    const base = out.base;
    const changed = (changes: Partial<Base>, more: Partial<WoodsState> = {}) =>
      woodsSounds(out, { ...out, ...more, base: { ...base, ...changes } });
    expect(woodsSounds(out, playScene(out, "rise"))).toEqual(["whoosh"]);
    expect(woodsSounds(out, playScene(out, "lair"))).toEqual(["warning"]);
    expect(woodsSounds(out, playScene(out, "peace"))).toEqual(["finish"]);
    expect(woodsSounds(out, playScene(out, "launch"))).toEqual(["launch"]);
    expect(changed({ allies: [true, false, false] })).toEqual(["join"]);
    expect(changed({ pieces: [false, true, false] })).toEqual(["chest"]);
    expect(changed({ installed: [false, false, true] })).toEqual(["gate"]);
    expect(changed({ cheered: 1 })).toEqual(["cheer"]);
    const dizzy = base.guards.map((guard, at) =>
      at === 0 ? { ...guard, dizzy: 200 } : guard,
    );
    expect(changed({ guards: dizzy })).toEqual(["guard"]);
    expect(changed({ freed: 1 })).toEqual(["freed"]);
    expect(changed({ broken: [true, false, false] })).toEqual(["burst"]);
    expect(changed({ ammo: base.ammo - 1 })).toEqual(["launch"]);
    expect(changed({}, { heartsLost: 1 })).toEqual(["hit"]);
    expect(changed({ forcefield: 600 })).toEqual(["shield"]);
    expect(changed({ heartTaken: true })).toEqual(["berry"]);
    expect(changed({ hatched: 1 })).toEqual(["ghost"]);
    expect(woodsSounds(maze, { ...maze, tick: 1 })).toEqual([]);
  });

  it("in DeFu's lair: her laser glowing, then burning, and her shockwave going off", () => {
    const maze = startWoods(1);
    const lair = { ...startBase(maze), lairStart: 0 };
    const at = (tick: number) => ({ ...maze, base: lair, escaped: true, tick });
    const glow = laserEvery - laserOn - laserWarn;
    expect(woodsSounds(at(glow - 1), at(glow))).toEqual(["warning"]);
    expect(woodsSounds(at(glow + laserWarn - 1), at(glow + laserWarn))).toEqual(
      ["laser"],
    );
    const wave = waveFirst + waveWarn;
    expect(woodsSounds(at(wave - 1), at(wave))).toEqual(["burst"]);
    expect(woodsSounds(at(wave), at(wave + 1))).toEqual([]);
  });

  it("in the castle: a breath, what is said, a show, a quick cheer, evading, a grumble back, a dodge and metaplasma", () => {
    const before = startCastle(1);
    const say = (id: string) =>
      castleSounds(before, { ...before, message: { id, tick: 1 } });
    expect(say("joined-1")).toEqual(["join"]);
    expect(say("got-2")).toEqual(["chest"]);
    expect(say("cheered-0")).toEqual(["cheer"]);
    expect(say("wants-0")).toEqual(["talk"]);
    expect(say("nap")).toEqual(["nap"]);
    expect(say("captured")).toEqual(["finish"]);
    expect(say("charm-1")).toEqual(["charm"]);
    expect(castleSounds(before, { ...before, fireTick: 3 })).toEqual(["fire"]);
    const asked = challenge(before, 0);
    const quiet = (state: typeof asked) => ({
      ...state,
      message: asked.message,
    });
    expect(castleSounds(asked, quiet(act(asked, 0)))).toEqual(["show"]);
    expect(castleSounds(asked, quiet(act(asked, quickMove)))).toEqual([
      "quick",
    ]);
    const evading = act(asked, evadeMove);
    expect(castleSounds(asked, quiet(evading))).toEqual(["evade"]);
    const dodged = reply({ ...evading, tick: evading.tick + showTicks });
    expect(castleSounds(evading, quiet(dodged))).toEqual(["evade"]);
    const shown = act(asked, 0);
    const answered = reply({ ...shown, tick: shown.tick + showTicks });
    expect(castleSounds(shown, quiet(answered))).toEqual(["reply"]);
    const gathered = { ...before, plasma: { ...before.plasma, gathered: 5 } };
    expect(castleSounds(before, gathered)).toEqual(["plasma"]);
  });
});
