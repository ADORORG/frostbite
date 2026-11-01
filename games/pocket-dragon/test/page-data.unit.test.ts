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
  withPlasma,
  withSound,
  withFame,
  fameSize,
} from "../src/progress.ts";
import { chapterIds, playIds } from "../src/rules/constants.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { startLaunch } from "../src/rules/woods/launch.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
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
      best: { castle: 5, hills: 900, quest: 0, woods: 0 },
      fame: [{ eggs: 80, hearts: 2, score: 41_000, secrets: 4, ticks: 50_000 }],
      plasma: 4_321,
      sound: { effects: false, music: true, volume: 0.3 },
      unlocked: 2,
      won: false,
    };
    expect(restore(good)).toEqual(good);
    expect(restore({ ...good, unlocked: 3, won: true }).won).toBe(true);
    expect(restore({ sound: defaultSound, unlocked: 3 })).toEqual({
      ...freshProgress,
      unlocked: 3,
    });
    // A save from before the quest (no quest best, no Hall of Fame) is read as one with neither yet.
    expect(
      restore({ best: { castle: 5, hills: 900, woods: 0 }, unlocked: 2 }),
    ).toMatchObject({ best: { quest: 0 }, fame: [] });
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
      { plasma: -5, unlocked: 1 },
      { plasma: 2.5, unlocked: 1 },
      { unlocked: 3, won: "yes" },
      { best: { quest: -2 }, unlocked: 1 },
      { fame: "best", unlocked: 1 },
      { fame: [null], unlocked: 1 },
      { fame: [{ ...good.fame[0], hearts: 100 }], unlocked: 1 },
      { fame: [{ eggs: 1 }], unlocked: 1 },
      { fame: Array.from({ length: 11 }, () => good.fame[0]), unlocked: 1 },
    ])
      expect(restore(bad)).toEqual(freshProgress);
    expect(restore({ best: {}, unlocked: 1 }).sound).toEqual(defaultSound);
  });

  it("keeps the best score of the quest and each level, banks metaplasma, opens the next level on a clear, notes the quest won, and saves the sound", () => {
    const best = withBest(freshProgress, "woods", 40);
    expect(best.best).toEqual({ castle: 0, hills: 0, quest: 0, woods: 40 });
    expect(withBest(best, "quest", 70).best.quest).toBe(70);
    expect(withBest(best, "woods", 30)).toBe(best);
    expect(withPlasma(withPlasma(freshProgress, 300), 25).plasma).toBe(325);
    expect(withCleared(freshProgress, "hills").unlocked).toBe(2);
    expect(
      withCleared({ ...freshProgress, unlocked: 3 }, "hills").unlocked,
    ).toBe(3);
    const captured = withCleared({ ...freshProgress, unlocked: 3 }, "woods");
    expect(captured).toMatchObject({ unlocked: 3, won: true });
    expect(withCleared(freshProgress, "castle").won).toBe(false);
    expect(withCleared(captured, "hills").won).toBe(true);
    expect(
      playIds.map((id) => isOpen(withCleared(freshProgress, "hills"), id)),
    ).toEqual([true, true, true, false]);
    const quiet = { ...defaultSound, music: false };
    expect(withSound(freshProgress, quiet).sound).toEqual(quiet);
    expect(saved(freshProgress)).toEqual({
      best: freshProgress.best,
      fame: [],
      plasma: 0,
      sound: defaultSound,
      unlocked: 1,
      won: false,
    });
  });
});

describe("the Hall of Fame", () => {
  const entry = (score: number, ticks: number) => ({
    eggs: 10,
    hearts: 1,
    score,
    secrets: 0,
    ticks,
  });

  it("keeps the ten best won quests, by score and then by time, and says where a new one went", () => {
    let progress = freshProgress;
    const ranks: (number | null)[] = [];
    for (let at = 0; at < 10; at += 1) {
      const placed = withFame(progress, entry(1_000 * (at + 1), 9_000));
      progress = placed.progress;
      ranks.push(placed.rank);
    }
    expect(ranks).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(progress.fame.map(({ score }) => score)).toEqual([
      10_000, 9_000, 8_000, 7_000, 6_000, 5_000, 4_000, 3_000, 2_000, 1_000,
    ]);
    // Too low to get in: it changes nothing but is said to have no place.
    const low = withFame(progress, entry(500, 100));
    expect(low.rank).toBeNull();
    expect(low.progress.fame).toEqual(progress.fame);
    // The same score, faster, goes above; slower goes below.
    expect(withFame(progress, entry(5_000, 8_000)).rank).toBe(6);
    expect(withFame(progress, entry(5_000, 10_000)).rank).toBe(7);
    expect(saved(progress).fame).toHaveLength(fameSize);
    expect(restore(saved(progress))).toEqual(progress);
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
      eggs: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      moonChest: true,
      parts: [true, false, false, false],
    };
    expect(woodsScore(woods)).toBe(1_000 + 300 + 1_000);
    expect(woodsStats(woods)).toEqual([
      ["Clues", "2 of 3"],
      ["Parts", "1 of 4"],
      ["Eggs", "2"],
    ]);
    const out = {
      ...woods,
      escaped: true,
      finishTick: 21_600,
      launch: { ...startLaunch(2, 5, 0), eggsLeft: 1, score: 400 },
    };
    expect(woodsScore(out)).toBe(woodsScore(woods) + 2_000 + 400);
    expect(woodsStats(out)[2]).toEqual(["Eggs", "1"]);
    const castle = {
      ...startCastle(1),
      charms: [true, false, false],
      cheered: [true, false, false, false],
      friends: [true, true, false, false],
    };
    expect(castleScore(castle)).toBe(1_000 + 800);
    expect(
      castleScore({ ...castle, bannerRaised: true, finishTick: 36_000 }),
    ).toBe(castleScore(castle) + 3_000);
    expect(castleStats(castle)).toEqual([
      ["Guild", "2 of 4"],
      ["Cheered", "1 of 4"],
      ["Charms", "1 of 3"],
    ]);
  });
});

describe("the tunes, effects and guides", () => {
  it("have a tune for every level, a guide for the quest and every level, and every sound the feedback names", () => {
    for (const id of chapterIds)
      expect(tracks[id].voices.length).toBeGreaterThan(0);
    for (const id of playIds) {
      expect(guides[id].lines).toHaveLength(3);
      expect(instructions[id].length).toBeGreaterThan(40);
    }
    expect(Object.keys(effects).length).toBeGreaterThan(30);
    const hills = startHills(1);
    const woods = startWoods(1);
    const castle = startCastle(1);
    const named = [
      ...hillsSounds(hills, { ...hills, charms: 1, plasmaBanked: 5 }),
      ...woodsSounds(woods, { ...woods, charms: [true, false, false] }),
      ...castleSounds(castle, {
        ...castle,
        message: { id: "found-charm-0", tick: 1 },
      }),
    ];
    expect(named).toEqual(["charm", "plasma", "charm", "charm"]);
    for (const name of named) expect(effects[name]).toBeDefined();
  });
});
