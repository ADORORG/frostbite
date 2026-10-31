import { defaultSound } from "@ador/game-sdk/audio/settings";
import { describe, expect, it } from "vitest";

import { effects, tracks } from "../src/audio.ts";
import { castleSounds, hillsSounds, woodsSounds } from "../src/feedback.ts";
import { guides, instructions } from "../src/guide.ts";
import {
  freshProgress,
  isOpen,
  restore,
  saved,
  withBest,
  withCleared,
  withSound,
} from "../src/progress.ts";
import { challenge, perform, reply } from "../src/rules/castle/battle.ts";
import { showTicks } from "../src/rules/castle/constants.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { chapterIds } from "../src/rules/constants.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import {
  castleScore,
  castleStats,
  hillsScore,
  hillsStats,
  woodsScore,
  woodsStats,
} from "../src/score.ts";

describe("the saved progress", () => {
  it("is read back only when it is this game's, and a fresh game otherwise", () => {
    const good = {
      best: { castle: 5, hills: 900, woods: 0 },
      sound: { effects: false, music: true, volume: 0.3 },
      unlocked: 2,
    };
    expect(restore(good)).toEqual(good);
    expect(restore({ sound: defaultSound, unlocked: 3 })).toEqual({
      ...freshProgress,
      unlocked: 3,
    });
    for (const bad of [
      null,
      7,
      "x",
      { unlocked: 0 },
      { unlocked: 4 },
      { unlocked: 1.5 },
      { best: 3, unlocked: 1 },
      { best: { hills: -1 }, unlocked: 1 },
      { best: { woods: "a" }, unlocked: 1 },
    ])
      expect(restore(bad)).toEqual(freshProgress);
    expect(restore({ best: {}, unlocked: 1 }).sound).toEqual(defaultSound);
  });

  it("keeps the best score of each chapter, opens the next chapter on a clear, and saves the sound", () => {
    const best = withBest(freshProgress, "woods", 40);
    expect(best.best).toEqual({ castle: 0, hills: 0, woods: 40 });
    expect(withBest(best, "woods", 30)).toBe(best);
    expect(withCleared(freshProgress, "hills").unlocked).toBe(2);
    expect(
      withCleared({ ...freshProgress, unlocked: 3 }, "hills").unlocked,
    ).toBe(3);
    expect(
      withCleared({ ...freshProgress, unlocked: 3 }, "castle").unlocked,
    ).toBe(3);
    expect(
      chapterIds.map((id) => isOpen(withCleared(freshProgress, "hills"), id)),
    ).toEqual([true, true, false]);
    const quiet = { ...defaultSound, music: false };
    expect(withSound(freshProgress, quiet).sound).toEqual(quiet);
    expect(saved(freshProgress)).toEqual({
      best: freshProgress.best,
      sound: defaultSound,
      unlocked: 1,
    });
  });
});

describe("the score and counts", () => {
  it("add up what each chapter's run has done, with a bonus for finishing early", () => {
    const hills = {
      ...startHills(1),
      cheers: 2,
      eggsBanked: 10,
      goldens: 1,
      meltedCount: 3,
      stagesCleared: 1,
    };
    expect(hillsScore(hills)).toBe(1_000 + 1_000 + 400 + 60 + 1_000);
    expect(hillsScore({ ...hills, finishTick: 21_600 - 400 })).toBe(
      hillsScore(hills) + 100,
    );
    expect(hillsStats(hills)).toEqual([
      ["Eggs", "10"],
      ["Hearts", "3"],
      ["Stage", "1 of 3"],
    ]);
    const woods = {
      ...startWoods(1),
      chests: [true, false, false, false, false],
      clues: [true, true, false],
      moonChest: true,
    };
    expect(woodsScore(woods)).toBe(1_000 + 300 + 1_000);
    expect(woodsScore({ ...woods, escaped: true, finishTick: 21_600 })).toBe(
      woodsScore(woods) + 2_000,
    );
    expect(woodsStats(woods)).toEqual([
      ["Clues", "2 of 3"],
      ["Chests", "2 of 6"],
      ["Lanterns", "0 of 3"],
    ]);
    const castle = {
      ...startCastle(1),
      cheered: [true, false, false, false],
      friends: [true, true, false, false],
      naps: 2,
    };
    expect(castleScore(castle)).toBe(1_000 + 800);
    expect(
      castleScore({ ...castle, bannerRaised: true, finishTick: 36_000 }),
    ).toBe(castleScore(castle) + 3_000);
    expect(castleStats(castle)).toEqual([
      ["Guild", "2 of 4"],
      ["Cheered", "1 of 4"],
      ["Naps", "2"],
    ]);
  });
});

describe("what is heard", () => {
  it("in Egg Hills: a jump, a breath, an egg, the golden egg, the berry, melting, a cheer, a bump and a stage", () => {
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
      cheers: 1,
      eggsBanked: 1,
      goldens: 1,
      hasFire: true,
      heartsLost: 1,
      meltedCount: 3,
      stagesCleared: 1,
    };
    expect(hillsSounds(before, busy)).toEqual([
      "fire",
      "egg",
      "golden",
      "berry",
      "melt",
      "cheer",
      "hit",
      "stage",
    ]);
    expect(
      hillsSounds(before, { ...before, finishTick: 9, stagesCleared: 1 }),
    ).toEqual(["finish"]);
    expect(hillsSounds(before, before)).toEqual([]);
  });

  it("in the woods: a breath, melting, a lantern, a clue (and the gate on the last), a chest and the way out", () => {
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
    const opened = { ...before, clues: [true, true, true] };
    expect(
      woodsSounds({ ...before, clues: [true, true, false] }, opened),
    ).toEqual(["gate"]);
    expect(woodsSounds(before, { ...before, moonChest: true })).toEqual([
      "chest",
    ]);
    expect(woodsSounds(before, { ...before, escaped: true })).toEqual([
      "finish",
    ]);
  });

  it("in the castle: a breath, what is said, a show and a grumble back", () => {
    const before = startCastle(1);
    const say = (id: string) =>
      castleSounds(before, { ...before, message: { id, tick: 1 } });
    expect(say("joined-1")).toEqual(["join"]);
    expect(say("got-2")).toEqual(["chest"]);
    expect(say("cheered-0")).toEqual(["cheer"]);
    expect(say("wants-0")).toEqual(["talk"]);
    expect(say("nap")).toEqual(["nap"]);
    expect(say("captured")).toEqual(["finish"]);
    expect(castleSounds(before, { ...before, fireTick: 3 })).toEqual(["fire"]);
    const asked = challenge(before, 0);
    const shown = perform(asked);
    expect(castleSounds({ ...asked, message: shown.message }, shown)).toEqual([
      "show",
    ]);
    const answered = reply({ ...shown, tick: shown.tick + showTicks });
    expect(
      castleSounds(shown, { ...answered, message: shown.message }),
    ).toEqual(["reply"]);
  });

  it("are all made of the sounds the game has, with a tune and a guide for every chapter", () => {
    for (const id of chapterIds) {
      expect(tracks[id].voices.length).toBeGreaterThan(0);
      expect(guides[id].lines).toHaveLength(3);
      expect(instructions[id].length).toBeGreaterThan(40);
    }
    expect(Object.keys(effects).length).toBeGreaterThan(20);
  });
});
