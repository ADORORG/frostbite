import { frequency, stepsAt } from "@frostbite/game-sdk/audio/tracks";
import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { worldSounds } from "../src/feedback.ts";
import { jumpSpeed, maxTicks, tile } from "../src/rules/constants.ts";
import { broRules } from "../src/rules/index.ts";
import { sample } from "../src/replay.ts";
import { sampleRun } from "../src/sample-run.ts";
import { scoreOf } from "../src/rules/score.ts";
import { onFlat, withHero } from "./support/states.ts";

const base = onFlat();

describe("the score", () => {
  it("is a hundred for a coin, two hundred for a stomp, fifty for a crate, and a bonus for the time left on a finish", () => {
    expect(scoreOf(base)).toBe(0);
    expect(scoreOf({ ...base, coinsTaken: [true, true, false] })).toBe(200);
    expect(scoreOf({ ...base, stomps: 3 })).toBe(600);
    expect(scoreOf({ ...base, crates: 4 })).toBe(200);
    expect(scoreOf({ ...base, finishTick: maxTicks - 400 })).toBe(100);
    expect(scoreOf({ ...base, finishTick: maxTicks })).toBe(0);
  });
});

describe("the sounds of what changed", () => {
  const jumped = withHero(base, { vy: -jumpSpeed + 4, grounded: false });
  it("is a jump when the hero left the ground, also just after running off an edge, and not otherwise", () => {
    expect(worldSounds(base, jumped)).toEqual(["jump"]);
    const edge = withHero(base, { coyote: 3, grounded: false });
    expect(worldSounds(edge, jumped)).toEqual(["jump"]);
    expect(
      worldSounds(withHero(base, { grounded: false, coyote: 0 }), jumped),
    ).toEqual([]);
    expect(worldSounds(base, base)).toEqual([]);
    expect(worldSounds(base, withHero(base, { vy: -jumpSpeed + 20 }))).toEqual(
      [],
    );
  });

  it("is a coin, a stomp (not a jump), a bump, a hit, a fall, a lantern and the goal, each when it happens", () => {
    expect(worldSounds(base, { ...base, coinsTaken: [true] })).toEqual([
      "coin",
    ]);
    expect(worldSounds(base, { ...jumped, stomps: 1 })).toEqual(["stomp"]);
    expect(worldSounds(base, { ...base, crates: 1 })).toEqual(["bump"]);
    expect(worldSounds(base, { ...base, hits: 1 })).toEqual(["hit"]);
    expect(worldSounds(base, { ...base, deaths: 1 })).toEqual(["die"]);
    expect(worldSounds(base, { ...base, deaths: 1, hits: 1 })).toEqual(["die"]);
    expect(worldSounds(base, { ...base, checkpoint: true })).toEqual([
      "checkpoint",
    ]);
    expect(
      worldSounds({ ...base, checkpoint: true }, { ...base, checkpoint: true }),
    ).toEqual([]);
    expect(worldSounds(base, { ...base, stagesCleared: 1 })).toEqual(["stage"]);
    expect(
      worldSounds(base, { ...base, finishTick: 5, stagesCleared: 6 }),
    ).toEqual(["finish"]);
    expect(
      worldSounds(
        { ...base, finishTick: 5, stagesCleared: 6 },
        { ...base, finishTick: 5, stagesCleared: 6 },
      ),
    ).toEqual([]);
  });

  it("comes in the order they would be heard", () => {
    const all = { ...jumped, coinsTaken: [true], crates: 1, hits: 1 };
    expect(worldSounds({ ...base, coinsTaken: [false] }, all)).toEqual([
      "jump",
      "coin",
      "bump",
      "hit",
    ]);
  });
});

describe("Bro Maria's sound", () => {
  it("has a track whose notes are playable and whose voices all sound somewhere", () => {
    expect(track.tempo).toBeGreaterThan(60);
    for (const voice of track.voices) {
      expect(voice.notes.some((note) => note !== null)).toBe(true);
      for (const note of voice.notes) {
        if (note === null) continue;
        expect(frequency(note)).toBeGreaterThan(40);
        expect(frequency(note)).toBeLessThan(4000);
      }
    }
    expect(stepsAt(track, 0).length).toBeGreaterThan(0);
  });

  it("has an effect for each thing that happens, each short and audible", () => {
    expect(Object.keys(effects).sort()).toEqual([
      "bump",
      "checkpoint",
      "coin",
      "die",
      "finish",
      "hit",
      "jump",
      "milestone",
      "stage",
      "start",
      "stomp",
    ]);
    for (const effect of Object.values(effects))
      for (const part of effect) {
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
      }
  });
});

describe("the verifier's sample run", () => {
  it("is a legal run that earns what it claims", () => {
    const record = sample();
    expect(record).toEqual(sampleRun());
    const outcome = replayRecord(broRules, record);
    expect(outcome).toMatchObject({ earned: record.claims, ok: true });
    expect(record.claims).toContain("finish");
    expect(tile).toBe(256);
  });
});
