import { replayRecord } from "@frostbite/game-sdk/replay";
import { maxRunRecordBytes } from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { permafrostRules } from "../src/rules/index.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import type { RunSession } from "../src/session.ts";
import {
  ace,
  decent,
  expert,
  novice,
  playBot,
  playIdle,
  playRandom,
} from "./support/bot.ts";

// How hard the game is, shown by who gets how far. Each player is the same every time (a bot with a skill and a seed), so the figures
// below are facts about the rules, not luck: if a change to the rules shifts them, a milestone has become easier, harder or out of reach.
const seed = 7_919;
const played = {
  ace: playBot({ seed: 15_838, skill: ace, ticks: maxTicks }),
  decent: playBot({ seed, skill: decent, ticks: maxTicks }),
  expert: playBot({ seed, skill: expert, ticks: maxTicks }),
  idle: playIdle(seed, maxTicks),
  novice: playBot({ seed, skill: novice, ticks: maxTicks }),
  random: playRandom(seed, maxTicks),
};

const earned = (session: RunSession): ReadonlySet<string> =>
  new Set(session.earned());

describe("who gets how far", () => {
  it("lets a player who does nothing get nowhere, and one who presses keys at random almost nowhere", () => {
    expect(played.idle.state().lines).toBe(0);
    expect(played.idle.state().score).toBe(0);
    expect(played.idle.earned()).toEqual([]);
    expect(played.idle.state().blocked).toBe(true);
    expect(played.random.state().lines).toBe(0);
    expect(played.random.earned()).toEqual(["first-hold"]);
    expect(played.random.clock() / 60).toBeLessThan(30);
  });

  it("ranks the players by how well they play, on lines, level and score", () => {
    const order = [
      played.idle,
      played.random,
      played.novice,
      played.decent,
      played.expert,
      played.ace,
    ];
    for (let at = 1; at < order.length; at += 1) {
      expect(order[at]?.state().score).toBeGreaterThan(
        order[at - 1]?.state().score ?? 0,
      );
      expect(order[at]?.state().lines).toBeGreaterThanOrEqual(
        order[at - 1]?.state().lines ?? 0,
      );
    }
  });

  it("gives a beginner their first milestones and nothing past the first levels", () => {
    expect(earned(played.novice)).toEqual(
      new Set([
        "first-line",
        "lines-10",
        "lines-25",
        "level-3",
        "score-1k",
        "score-5k",
        "combo-3",
      ]),
    );
  });

  it("gives a steady player the middle of the list, with the hard ones still ahead of them", () => {
    const got = earned(played.decent);
    for (const id of [
      "lines-100",
      "level-15",
      "score-100k",
      "first-four",
      "sprint-90s",
      "rising-10",
    ])
      expect(got.has(id)).toBe(true);
    for (const id of [
      "lines-150",
      "lines-200",
      "level-20",
      "score-250k",
      "rising-25",
    ])
      expect(got.has(id)).toBe(false);
  });

  it("gives a quick player more still, and lets only the best reach the top of the list", () => {
    const quick = earned(played.expert);
    expect(quick.has("lines-150")).toBe(true);
    for (const id of ["lines-200", "level-20", "score-250k", "rising-25"]) {
      expect(quick.has(id)).toBe(false);
      expect(earned(played.ace).has(id)).toBe(true);
    }
  });

  it("keeps the milestones only a technique earns out of the bots' reach, so they stay worth earning", () => {
    const anyBot = new Set(
      Object.values(played).flatMap((session) => session.earned()),
    );
    const technique = milestoneIds.filter((id) => !anyBot.has(id));
    expect(technique).toEqual([
      "fours-5",
      "fours-20",
      "combo-6",
      "combo-10",
      "back-to-back",
      "back-to-back-5",
      "perfect-clear",
    ]);
  });

  it("spreads the milestones, the first quarter reachable by a beginner and fewer than a quarter by no bot at all", () => {
    const easy = earned(played.novice).size + earned(played.random).size;
    expect(easy / milestoneIds.length).toBeGreaterThanOrEqual(0.25);
    expect(easy / milestoneIds.length).toBeLessThan(0.4);
    const reached = new Set(Object.values(played).flatMap((s) => s.earned()));
    expect(
      (milestoneIds.length - reached.size) / milestoneIds.length,
    ).toBeLessThan(0.25);
  });
});

describe("a run recorded as it is played", () => {
  for (const [name, session] of Object.entries(played)) {
    it(`replays, for ${name}, to the score and milestones the player saw, in a record the platform accepts`, () => {
      const record = session.record();
      const outcome = replayRecord(permafrostRules, record);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.score).toBe(session.state().score);
      expect([...outcome.earned].sort()).toEqual([...session.earned()].sort());
      expect(session.state().ended).toBe(true);
      expect(JSON.stringify(record).length).toBeLessThan(maxRunRecordBytes);
      expect(session.record()).toBe(record);
    });
  }

  it("is the same record whoever plays it, for the same seed and keys", () => {
    const again = playBot({ seed, skill: decent, ticks: maxTicks });
    expect(again.record().inputs).toEqual(played.decent.record().inputs);
  });
});
